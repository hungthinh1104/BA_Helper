import type { Client } from 'pg';

export async function seedLegacyEvidence(client: Client): Promise<void> {
  await client.query(`INSERT INTO "Evidence"
    (id, "provenanceKey", "sourceType", "snapshotId", "artifactId", "sourcePath", excerpt, "contentHash")
    VALUES ('upgrade-evidence', 'upgrade:evidence:method', 'CODE', 'upgrade-snapshot', 'upgrade-method',
      'booking.service.ts', 'return refundForBooking(bookingId);', 'upgrade-evidence-hash')`);
}

export async function verifyLegacyEvidence(client: Client): Promise<string[]> {
  const failures: string[] = [];
  const evidence = await client.query(`SELECT "provenanceKey", "snapshotId", "artifactId", excerpt, "contentHash"
    FROM "Evidence" WHERE id = 'upgrade-evidence'`);
  if (evidence.rowCount !== 1 || evidence.rows[0].snapshotId !== 'upgrade-snapshot' ||
      evidence.rows[0].artifactId !== 'upgrade-method' || evidence.rows[0].excerpt !== 'return refundForBooking(bookingId);' ||
      evidence.rows[0].contentHash !== 'upgrade-evidence-hash') {
    failures.push('legacy evidence content or snapshot/artifact provenance changed');
  }

  const constraints = await client.query(`SELECT conname, convalidated FROM pg_constraint
    WHERE conrelid = '"Evidence"'::regclass
      AND conname IN (
        'Evidence_artifactId_fkey',
        'Evidence_artifactId_snapshotId_fkey',
        'Evidence_artifact_requires_snapshot_check'
      )`);
  const constraintsByName = new Map(constraints.rows.map((row) => [row.conname, row.convalidated]));
  if (constraintsByName.has('Evidence_artifactId_fkey') ||
      constraintsByName.get('Evidence_artifactId_snapshotId_fkey') !== true ||
      constraintsByName.get('Evidence_artifact_requires_snapshot_check') !== true) {
    failures.push('Evidence snapshot/artifact constraints are missing, unvalidated, or still legacy-scoped');
  }

  await client.query(`INSERT INTO "RepositorySnapshot"
    (id, "repositoryId", "commitSha", "analyzerVersion", "coverageStatus", "updatedAt")
    VALUES ('upgrade-evidence-foreign-snapshot', 'upgrade-repository', $1, 'analyzer@0.3.0', 'READY', now())`,
  ['e'.repeat(40)]);
  await client.query(`INSERT INTO "CodeArtifact"
    (id, "snapshotId", "artifactKey", name, "artifactType", "filePath", "updatedAt")
    VALUES ('upgrade-evidence-foreign-artifact', 'upgrade-evidence-foreign-snapshot', 'method:evidence-foreign',
      'foreign', 'SERVICE_METHOD', 'foreign.service.ts', now())`);
  try {
    await client.query(`INSERT INTO "Evidence"
      (id, "provenanceKey", "sourceType", "snapshotId", "artifactId", excerpt, "contentHash")
      VALUES ('upgrade-cross-snapshot-evidence', 'upgrade:evidence:invalid', 'CODE', 'upgrade-snapshot',
        'upgrade-evidence-foreign-artifact', 'invalid', 'invalid-hash')`);
    failures.push('Evidence accepted an artifact from another snapshot');
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown';
    if (code !== '23503') throw new Error(`Expected cross-snapshot Evidence to fail with 23503, received ${code}.`);
  }
  const rejected = await client.query(`SELECT count(*)::int AS count FROM "Evidence"
    WHERE id = 'upgrade-cross-snapshot-evidence'`);
  if (rejected.rows[0]?.count !== 0) failures.push('cross-snapshot Evidence row was persisted');
  return failures;
}

export async function seedCrossSnapshotEvidenceHistory(client: Client): Promise<void> {
  await client.query(`INSERT INTO "RepositorySnapshot"
    (id, "repositoryId", "commitSha", "analyzerVersion", "coverageStatus", "updatedAt")
    VALUES ('upgrade-invalid-evidence-snapshot', 'upgrade-repository', $1, 'analyzer@0.3.0', 'READY', now())`,
  ['f'.repeat(40)]);
  await client.query(`INSERT INTO "CodeArtifact"
    (id, "snapshotId", "artifactKey", name, "artifactType", "filePath", "updatedAt")
    VALUES ('upgrade-invalid-evidence-artifact', 'upgrade-invalid-evidence-snapshot', 'method:evidence-invalid',
      'invalid', 'SERVICE_METHOD', 'invalid.service.ts', now())`);
  await client.query(`INSERT INTO "Evidence"
    (id, "provenanceKey", "sourceType", "snapshotId", "artifactId", excerpt, "contentHash")
    VALUES ('upgrade-invalid-evidence', 'upgrade:evidence:invalid-history', 'CODE', 'upgrade-snapshot',
      'upgrade-invalid-evidence-artifact', 'historical mismatched evidence', 'invalid-evidence-hash')`);
  await client.query(`INSERT INTO "Evidence"
    (id, "provenanceKey", "sourceType", "snapshotId", "artifactId", excerpt, "contentHash")
    VALUES ('upgrade-null-snapshot-evidence', 'upgrade:evidence:null-snapshot-history', 'CODE', NULL,
      'upgrade-method', 'historical artifact evidence without snapshot', 'null-snapshot-evidence-hash')`);
}

export async function assertHistoricalEvidencePreserved(client: Client): Promise<void> {
  const evidence = await client.query(`SELECT "snapshotId", "artifactId", excerpt FROM "Evidence"
    WHERE id = 'upgrade-invalid-evidence'`);
  if (evidence.rowCount !== 1 || evidence.rows[0].snapshotId !== 'upgrade-snapshot' ||
      evidence.rows[0].artifactId !== 'upgrade-invalid-evidence-artifact' ||
      evidence.rows[0].excerpt !== 'historical mismatched evidence') {
    throw new Error('Fail-closed migration changed or deleted historical mismatched Evidence.');
  }
  const missingSnapshotEvidence = await client.query(`SELECT "snapshotId", "artifactId", excerpt FROM "Evidence"
    WHERE id = 'upgrade-null-snapshot-evidence'`);
  if (missingSnapshotEvidence.rowCount !== 1 || missingSnapshotEvidence.rows[0].snapshotId !== null ||
      missingSnapshotEvidence.rows[0].artifactId !== 'upgrade-method' ||
      missingSnapshotEvidence.rows[0].excerpt !== 'historical artifact evidence without snapshot') {
    throw new Error('Fail-closed migration changed or deleted historical Evidence missing its snapshot.');
  }
  const constraints = await client.query(`SELECT conname FROM pg_constraint
    WHERE conrelid = '"Evidence"'::regclass
      AND conname IN (
        'Evidence_artifactId_fkey',
        'Evidence_artifactId_snapshotId_fkey',
        'Evidence_artifact_requires_snapshot_check'
      )`);
  const names = new Set(constraints.rows.map((row) => row.conname));
  if (!names.has('Evidence_artifactId_fkey') || names.has('Evidence_artifactId_snapshotId_fkey') ||
      names.has('Evidence_artifact_requires_snapshot_check')) {
    throw new Error('Failed Evidence migration partially replaced an artifact/snapshot constraint.');
  }
}

export async function seedMissingEvidenceOriginHistory(client: Client): Promise<void> {
  await client.query(`INSERT INTO "Evidence"
    (id, "provenanceKey", "sourceType", "snapshotId", "artifactId", "sourcePath", excerpt, "contentHash")
    VALUES ('upgrade-unscoped-code-evidence', 'upgrade:evidence:unscoped-code', 'CODE', NULL, NULL,
      'unscoped.ts', 'repository evidence missing its snapshot', 'unscoped-code-hash')`);
  await client.query(`INSERT INTO "Evidence"
    (id, "provenanceKey", "sourceType", "snapshotId", "artifactId", excerpt, "contentHash")
    VALUES ('upgrade-unscoped-requirement-evidence', 'upgrade:evidence:unscoped-requirement',
      'REQUIREMENT_INPUT', NULL, NULL, 'requirement evidence missing its revision', 'unscoped-requirement-hash')`);
}

export async function assertMissingEvidenceOriginHistoryPreserved(client: Client): Promise<void> {
  const rows = await client.query(`SELECT id, "sourceType", "snapshotId", "requirementRevisionId", excerpt
    FROM "Evidence"
    WHERE id IN ('upgrade-unscoped-code-evidence', 'upgrade-unscoped-requirement-evidence')
    ORDER BY id`);
  if (rows.rowCount !== 2 ||
      !rows.rows.some((row) => row.id === 'upgrade-unscoped-code-evidence' &&
        row.sourceType === 'CODE' && row.snapshotId === null && row.excerpt === 'repository evidence missing its snapshot') ||
      !rows.rows.some((row) => row.id === 'upgrade-unscoped-requirement-evidence' &&
        row.sourceType === 'REQUIREMENT_INPUT' && row.requirementRevisionId === null &&
        row.excerpt === 'requirement evidence missing its revision')) {
    throw new Error('Failed Evidence origin migration changed or deleted historical unscoped rows.');
  }

  const constraint = await client.query(`SELECT 1 FROM pg_constraint
    WHERE conrelid = '"Evidence"'::regclass AND conname = 'Evidence_source_origin_scope_check'`);
  if (constraint.rowCount !== 0) {
    throw new Error('Failed Evidence origin migration partially added its CHECK constraint.');
  }
}
