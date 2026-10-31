import type { Client } from 'pg';

export async function seedLegacyTraceabilityLink(client: Client): Promise<void> {
  await client.query(`INSERT INTO "TraceabilityLink"
    (id, "impactAnalysisId", "artifactId", "linkType", "linkBasis", "reviewStatus", "createdAt", "updatedAt")
    VALUES ('upgrade-traceability-link', 'upgrade-analysis', 'upgrade-method',
      'AFFECTED', 'EVIDENCED', 'NEEDS_REVIEW', now(), now())`);
}

export async function verifyLegacyTraceabilityLink(client: Client): Promise<string[]> {
  const failures: string[] = [];
  const link = await client.query(`SELECT "impactAnalysisId", "snapshotId", "artifactId", "linkType"
    FROM "TraceabilityLink" WHERE id='upgrade-traceability-link'`);
  if (link.rowCount !== 1 || link.rows[0].impactAnalysisId !== 'upgrade-analysis' ||
      link.rows[0].snapshotId !== 'upgrade-snapshot' || link.rows[0].artifactId !== 'upgrade-method' ||
      link.rows[0].linkType !== 'AFFECTED') {
    failures.push('legacy TraceabilityLink identity or backfilled snapshot changed');
  }

  const constraints = await client.query(`SELECT conname, convalidated FROM pg_constraint
    WHERE conrelid='"TraceabilityLink"'::regclass
      AND conname IN ('TraceabilityLink_impactAnalysisId_snapshotId_fkey', 'TraceabilityLink_artifactId_snapshotId_fkey')`);
  if (constraints.rowCount !== 2 || constraints.rows.some((constraint) => !constraint.convalidated)) {
    failures.push('snapshot-scoped TraceabilityLink foreign keys are missing or unvalidated');
  }

  await client.query(`INSERT INTO "RepositorySnapshot"
    (id, "repositoryId", "commitSha", "analyzerVersion", "coverageStatus", "updatedAt")
    VALUES ('upgrade-traceability-foreign-snapshot', 'upgrade-repository', $1, 'analyzer@0.3.0', 'READY', now())`,
  ['d'.repeat(40)]);
  await client.query(`INSERT INTO "CodeArtifact"
    (id, "snapshotId", "artifactKey", name, "artifactType", "filePath", "updatedAt")
    VALUES ('upgrade-traceability-foreign-artifact', 'upgrade-traceability-foreign-snapshot',
      'method:traceability-foreign', 'foreign', 'SERVICE_METHOD', 'foreign.service.ts', now())`);
  try {
    await client.query(`INSERT INTO "TraceabilityLink"
      (id, "impactAnalysisId", "snapshotId", "artifactId", "linkType", "linkBasis", "reviewStatus", "createdAt", "updatedAt")
      VALUES ('upgrade-cross-snapshot-traceability', 'upgrade-analysis', 'upgrade-snapshot',
        'upgrade-traceability-foreign-artifact', 'RELATED', 'INFERRED', 'NEEDS_REVIEW', now(), now())`);
    failures.push('TraceabilityLink accepted an artifact from another snapshot');
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown';
    if (code !== '23503') throw new Error(`Expected cross-snapshot TraceabilityLink to fail with 23503, received ${code}.`);
  }
  const rejected = await client.query(`SELECT count(*)::int AS count FROM "TraceabilityLink"
    WHERE id='upgrade-cross-snapshot-traceability'`);
  if (rejected.rows[0]?.count !== 0) failures.push('cross-snapshot TraceabilityLink row was persisted');
  return failures;
}

export async function seedCrossSnapshotTraceabilityHistory(client: Client): Promise<void> {
  await client.query(`INSERT INTO "RepositorySnapshot"
    (id, "repositoryId", "commitSha", "analyzerVersion", "coverageStatus", "updatedAt")
    VALUES ('upgrade-invalid-traceability-snapshot', 'upgrade-repository', $1, 'analyzer@0.3.0', 'READY', now())`,
  ['a'.repeat(40)]);
  await client.query(`INSERT INTO "CodeArtifact"
    (id, "snapshotId", "artifactKey", name, "artifactType", "filePath", "updatedAt")
    VALUES ('upgrade-invalid-traceability-artifact', 'upgrade-invalid-traceability-snapshot',
      'method:traceability-invalid', 'invalid', 'SERVICE_METHOD', 'invalid.service.ts', now())`);
  await client.query(`INSERT INTO "TraceabilityLink"
    (id, "impactAnalysisId", "artifactId", "linkType", "linkBasis", "reviewStatus", "createdAt", "updatedAt")
    VALUES ('upgrade-invalid-traceability-link', 'upgrade-analysis', 'upgrade-invalid-traceability-artifact',
      'AFFECTED', 'INFERRED', 'NEEDS_REVIEW', now(), now())`);
}

export async function assertHistoricalTraceabilityLinkPreserved(client: Client): Promise<void> {
  const link = await client.query(`SELECT "impactAnalysisId", "artifactId", "linkType"
    FROM "TraceabilityLink" WHERE id='upgrade-invalid-traceability-link'`);
  if (link.rowCount !== 1 || link.rows[0].impactAnalysisId !== 'upgrade-analysis' ||
      link.rows[0].artifactId !== 'upgrade-invalid-traceability-artifact' || link.rows[0].linkType !== 'AFFECTED') {
    throw new Error('Fail-closed migration changed or deleted the historical TraceabilityLink.');
  }
  const column = await client.query(`SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='TraceabilityLink' AND column_name='snapshotId'`);
  if (column.rowCount !== 0) throw new Error('Failed TraceabilityLink migration partially added its snapshot column.');
  const constraints = await client.query(`SELECT conname FROM pg_constraint
    WHERE conrelid='"TraceabilityLink"'::regclass
      AND conname IN ('TraceabilityLink_impactAnalysisId_fkey', 'TraceabilityLink_artifactId_fkey',
        'TraceabilityLink_impactAnalysisId_snapshotId_fkey', 'TraceabilityLink_artifactId_snapshotId_fkey')`);
  const names = new Set(constraints.rows.map((row) => row.conname));
  if (!names.has('TraceabilityLink_impactAnalysisId_fkey') || !names.has('TraceabilityLink_artifactId_fkey') ||
      names.has('TraceabilityLink_impactAnalysisId_snapshotId_fkey') ||
      names.has('TraceabilityLink_artifactId_snapshotId_fkey')) {
    throw new Error('Failed TraceabilityLink migration partially replaced its foreign keys.');
  }
}
