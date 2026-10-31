import type { Client } from 'pg';

const FOREIGN_ANALYSIS_ID = 'upgrade-analysis-cross-repository';

export async function verifyLegacyImpactAnalysisRepositoryScope(client: Client): Promise<string[]> {
  const failures: string[] = [];
  const analysis = await client.query(`SELECT analysis."repositoryId", snapshot."repositoryId" AS snapshot_repository_id
    FROM "ImpactAnalysis" AS analysis
    JOIN "RepositorySnapshot" AS snapshot ON snapshot.id = analysis."snapshotId"
    WHERE analysis.id = 'upgrade-analysis'`);
  if (analysis.rowCount !== 1 || analysis.rows[0].repositoryId !== 'upgrade-repository' ||
      analysis.rows[0].snapshot_repository_id !== 'upgrade-repository') {
    failures.push('legacy analysis repository identity was not backfilled from its snapshot');
  }

  const constraints = await client.query(`SELECT conname, convalidated, confdeltype FROM pg_constraint
    WHERE conrelid = '"ImpactAnalysis"'::regclass
      AND conname IN (
        'ImpactAnalysis_snapshotId_repositoryId_fkey',
        'ImpactAnalysis_sourceTargetId_repositoryId_fkey'
      )`);
  if (constraints.rowCount !== 2 || constraints.rows.some((constraint) =>
    !constraint.convalidated || constraint.confdeltype !== 'r')) {
    failures.push('same-repository ImpactAnalysis snapshot/target foreign keys are missing, unvalidated, or do not restrict provenance deletion');
  }

  try {
    await client.query(`INSERT INTO "ImpactAnalysis"
      (id, "requirementRevisionId", "requirementId", "projectId", "repositoryId", "snapshotId", "sourceTargetId",
        "requestKey", status, stage, "updatedAt")
      VALUES ('upgrade-analysis-cross-repository-future', 'upgrade-revision', 'upgrade-requirement', 'upgrade-project', 'upgrade-repository',
        'upgrade-snapshot', 'upgrade-scan-foreign-target', 'upgrade-analysis-cross-repository-future-request',
        'COMPLETED', 'DONE', now())`);
    failures.push('ImpactAnalysis accepted a source target from another snapshot repository');
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown';
    if (code !== '23503') throw new Error(`Expected cross-repository analysis to fail with 23503, received ${code}.`);
  }
  const rejected = await client.query(`SELECT 1 FROM "ImpactAnalysis" WHERE id = 'upgrade-analysis-cross-repository-future'`);
  if (rejected.rowCount !== 0) failures.push('rejected cross-repository analysis was persisted');
  return failures;
}

export async function seedCrossRepositoryImpactAnalysisHistory(client: Client): Promise<void> {
  await client.query(`INSERT INTO "Project" (id, name, "updatedAt")
    VALUES ('upgrade-analysis-foreign-project', 'Foreign analysis project', now())
    ON CONFLICT (id) DO NOTHING`);
  await client.query(`INSERT INTO "Repository" (id, "projectId", "canonicalUrl", "updatedAt")
    VALUES ('upgrade-analysis-foreign-repository', 'upgrade-analysis-foreign-project',
      'https://github.com/example/foreign-analysis', now()) ON CONFLICT (id) DO NOTHING`);
  await client.query(`INSERT INTO "RepositoryTarget"
    (id, "repositoryId", "targetKey", "requestedRef", "resolvedRefType", "latestObservedCommitSha", "lastObservedAt", "updatedAt")
    VALUES ('upgrade-analysis-foreign-target', 'upgrade-analysis-foreign-repository', 'branch:main', 'main',
      'BRANCH', 'foreign-analysis-commit', now(), now()) ON CONFLICT (id) DO NOTHING`);
  await client.query(`INSERT INTO "ImpactAnalysis"
    (id, "requirementRevisionId", "snapshotId", "sourceTargetId", "requestKey", status, stage, "updatedAt")
    VALUES ($1, 'upgrade-revision', 'upgrade-snapshot', 'upgrade-analysis-foreign-target',
      'upgrade-analysis-invalid-history-request', 'COMPLETED', 'DONE', now())`, [FOREIGN_ANALYSIS_ID]);
}

export async function assertCrossRepositoryImpactAnalysisHistoryPreserved(client: Client): Promise<void> {
  const row = await client.query(`SELECT "snapshotId", "sourceTargetId" FROM "ImpactAnalysis" WHERE id = $1`, [FOREIGN_ANALYSIS_ID]);
  if (row.rowCount !== 1 || row.rows[0].snapshotId !== 'upgrade-snapshot' ||
      row.rows[0].sourceTargetId !== 'upgrade-analysis-foreign-target') {
    throw new Error('Failed ImpactAnalysis migration changed or deleted the historical cross-repository row.');
  }

  const repositoryColumn = await client.query(`SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ImpactAnalysis' AND column_name = 'repositoryId'`);
  if (repositoryColumn.rowCount !== 0) {
    throw new Error('Failed ImpactAnalysis migration partially added repositoryId.');
  }
  const constraints = await client.query(`SELECT conname FROM pg_constraint
    WHERE conrelid = '"ImpactAnalysis"'::regclass
      AND conname IN ('ImpactAnalysis_snapshotId_fkey', 'ImpactAnalysis_sourceTargetId_fkey',
        'ImpactAnalysis_snapshotId_repositoryId_fkey', 'ImpactAnalysis_sourceTargetId_repositoryId_fkey')`);
  const names = new Set(constraints.rows.map((constraint) => constraint.conname));
  if (!names.has('ImpactAnalysis_snapshotId_fkey') || !names.has('ImpactAnalysis_sourceTargetId_fkey') ||
      names.has('ImpactAnalysis_snapshotId_repositoryId_fkey') || names.has('ImpactAnalysis_sourceTargetId_repositoryId_fkey')) {
    throw new Error('Failed ImpactAnalysis migration partially replaced the original foreign keys.');
  }
}
