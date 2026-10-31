import type { Client } from 'pg';

const VALID_JOB_ID = 'upgrade-scan-job';
const FOREIGN_TARGET_JOB_ID = 'upgrade-scan-cross-target-job';
const FOREIGN_SNAPSHOT_JOB_ID = 'upgrade-scan-cross-snapshot-job';

export async function seedLegacyScanJob(client: Client): Promise<void> {
  await client.query(`INSERT INTO "ScanJob"
    (id, "repositoryId", "requestKey", status, stage, progress,
      "sourceTargetId", "snapshotId", "updatedAt")
    VALUES ($1, 'upgrade-repository', 'upgrade-scan-request', 'COMPLETED', 'DONE', 100,
      'upgrade-target', 'upgrade-snapshot', now())`, [VALID_JOB_ID]);
}

export async function verifyLegacyScanJob(client: Client): Promise<string[]> {
  const failures: string[] = [];
  const job = await client.query(`SELECT "repositoryId", "sourceTargetId", "snapshotId", status, stage
    FROM "ScanJob" WHERE id = $1`, [VALID_JOB_ID]);
  if (job.rowCount !== 1 || job.rows[0].repositoryId !== 'upgrade-repository' ||
      job.rows[0].sourceTargetId !== 'upgrade-target' || job.rows[0].snapshotId !== 'upgrade-snapshot' ||
      job.rows[0].status !== 'COMPLETED' || job.rows[0].stage !== 'DONE') {
    failures.push('legacy scan job identity or lifecycle state changed');
  }

  const constraints = await client.query(`SELECT conname, convalidated, confdeltype FROM pg_constraint
    WHERE conrelid = '"ScanJob"'::regclass
      AND conname IN (
        'ScanJob_sourceTargetId_repositoryId_fkey',
        'ScanJob_snapshotId_repositoryId_fkey'
      )`);
  if (constraints.rowCount !== 2 || constraints.rows.some((constraint) =>
    !constraint.convalidated || constraint.confdeltype !== 'r')) {
    failures.push('same-repository ScanJob target/snapshot foreign keys are missing, unvalidated, or do not restrict provenance deletion');
  }

  for (const indexName of ['RepositoryTarget_id_repositoryId_key', 'RepositorySnapshot_id_repositoryId_key']) {
    const index = await client.query('SELECT to_regclass($1) AS index_name', [`"${indexName}"`]);
    if (!index.rows[0]?.index_name) failures.push(`composite scan scope index ${indexName} is missing`);
  }

  await seedForeignRepositoryResources(client);
  failures.push(...await expectScanJobRejected(client, {
    id: 'upgrade-scan-future-cross-target',
    requestKey: 'upgrade-scan-future-cross-target-request',
    sourceTargetId: 'upgrade-scan-foreign-target',
  }));
  failures.push(...await expectScanJobRejected(client, {
    id: 'upgrade-scan-future-cross-snapshot',
    requestKey: 'upgrade-scan-future-cross-snapshot-request',
    snapshotId: 'upgrade-scan-foreign-snapshot',
  }));
  return failures;
}

export async function seedCrossRepositoryScanJobHistory(client: Client): Promise<void> {
  await seedForeignRepositoryResources(client);
  await client.query(`INSERT INTO "ScanJob"
    (id, "repositoryId", "requestKey", status, stage, "sourceTargetId", "updatedAt")
    VALUES ($1, 'upgrade-repository', 'upgrade-scan-invalid-target-request', 'COMPLETED', 'DONE',
      'upgrade-scan-foreign-target', now())`, [FOREIGN_TARGET_JOB_ID]);
  await client.query(`INSERT INTO "ScanJob"
    (id, "repositoryId", "requestKey", status, stage, "snapshotId", "updatedAt")
    VALUES ($1, 'upgrade-repository', 'upgrade-scan-invalid-snapshot-request', 'COMPLETED', 'DONE',
      'upgrade-scan-foreign-snapshot', now())`, [FOREIGN_SNAPSHOT_JOB_ID]);
}

export async function assertCrossRepositoryScanJobHistoryPreserved(client: Client): Promise<void> {
  const jobs = await client.query(`SELECT id, "repositoryId", "sourceTargetId", "snapshotId"
    FROM "ScanJob" WHERE id = ANY($1::text[]) ORDER BY id`,
  [[FOREIGN_SNAPSHOT_JOB_ID, FOREIGN_TARGET_JOB_ID]]);
  if (jobs.rowCount !== 2 ||
      !jobs.rows.some((job) => job.id === FOREIGN_TARGET_JOB_ID &&
        job.repositoryId === 'upgrade-repository' && job.sourceTargetId === 'upgrade-scan-foreign-target') ||
      !jobs.rows.some((job) => job.id === FOREIGN_SNAPSHOT_JOB_ID &&
        job.repositoryId === 'upgrade-repository' && job.snapshotId === 'upgrade-scan-foreign-snapshot')) {
    throw new Error('Failed ScanJob migration changed or deleted historical cross-repository rows.');
  }

  const constraints = await client.query(`SELECT conname FROM pg_constraint
    WHERE conrelid = '"ScanJob"'::regclass
      AND conname IN (
        'ScanJob_sourceTargetId_fkey', 'ScanJob_snapshotId_fkey',
        'ScanJob_sourceTargetId_repositoryId_fkey', 'ScanJob_snapshotId_repositoryId_fkey'
      )`);
  const names = new Set(constraints.rows.map((constraint) => constraint.conname));
  if (!names.has('ScanJob_sourceTargetId_fkey') || !names.has('ScanJob_snapshotId_fkey') ||
      names.has('ScanJob_sourceTargetId_repositoryId_fkey') || names.has('ScanJob_snapshotId_repositoryId_fkey')) {
    throw new Error('Failed ScanJob migration partially replaced the previous foreign keys.');
  }

  for (const indexName of ['RepositoryTarget_id_repositoryId_key', 'RepositorySnapshot_id_repositoryId_key']) {
    const index = await client.query('SELECT to_regclass($1) AS index_name', [`"${indexName}"`]);
    if (index.rows[0]?.index_name) throw new Error(`Failed ScanJob migration left index ${indexName} behind.`);
  }
}

async function seedForeignRepositoryResources(client: Client): Promise<void> {
  await client.query(`INSERT INTO "Project" (id, name, "updatedAt")
    VALUES ('upgrade-scan-foreign-project', 'Foreign scan project', now())
    ON CONFLICT (id) DO NOTHING`);
  await client.query(`INSERT INTO "Repository" (id, "projectId", "canonicalUrl", "updatedAt")
    VALUES ('upgrade-scan-foreign-repository', 'upgrade-scan-foreign-project',
      'https://github.com/example/foreign-scan', now()) ON CONFLICT (id) DO NOTHING`);
  await client.query(`INSERT INTO "RepositoryTarget"
    (id, "repositoryId", "targetKey", "requestedRef", "resolvedRefType",
      "latestObservedCommitSha", "lastObservedAt", "updatedAt")
    VALUES ('upgrade-scan-foreign-target', 'upgrade-scan-foreign-repository', 'branch:main', 'main',
      'BRANCH', 'foreign-scan-commit', now(), now()) ON CONFLICT (id) DO NOTHING`);
  await client.query(`INSERT INTO "RepositorySnapshot"
    (id, "repositoryId", "commitSha", "analyzerVersion", "coverageStatus", "updatedAt")
    VALUES ('upgrade-scan-foreign-snapshot', 'upgrade-scan-foreign-repository',
      'foreign-scan-commit', 'analyzer@0.3.0', 'READY', now()) ON CONFLICT (id) DO NOTHING`);
}

async function expectScanJobRejected(
  client: Client,
  input: { id: string; requestKey: string; sourceTargetId?: string; snapshotId?: string },
): Promise<string[]> {
  try {
    await client.query(`INSERT INTO "ScanJob"
      (id, "repositoryId", "requestKey", status, stage, "sourceTargetId", "snapshotId", "updatedAt")
      VALUES ($1, 'upgrade-repository', $2, 'QUEUED', 'WAITING', $3, $4, now())`,
    [input.id, input.requestKey, input.sourceTargetId ?? null, input.snapshotId ?? null]);
    return [`ScanJob accepted a foreign ${input.sourceTargetId ? 'source target' : 'snapshot'}`];
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown';
    if (code !== '23503') throw new Error(`Expected foreign ScanJob relation to fail with 23503, received ${code}.`);
    return [];
  }
}
