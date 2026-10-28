import type { Client } from 'pg';

const commitSha = 'b'.repeat(40);
const markdown = '# Historical reviewed report\n';

/** SQL intentionally omits all new columns: these rows predate test-trace support. */
export async function seedLegacyTestTraceData(client: Client): Promise<void> {
  const columns = await client.query(`SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND ((table_name = 'DependencyEdge' AND column_name IN ('confidence', 'metadata'))
      OR (table_name = 'CodeArtifact' AND column_name = 'metadata')
      OR (table_name = 'reviewed_report_snapshot' AND column_name = 'test_trace_snapshot'))`);
  if (columns.rowCount !== 0) throw new Error('Legacy schema already contains test-trace columns.');
  const requestKeyColumn = await client.query(`SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Requirement' AND column_name = 'requestKey'`);
  if (requestKeyColumn.rowCount !== 0) {
    throw new Error('Legacy schema already contains the requirement idempotency column.');
  }

  await client.query(`INSERT INTO "Project" (id, name, "updatedAt") VALUES ('upgrade-project', 'Upgrade fixture', now())`);
  await client.query(`INSERT INTO "Repository" (id, "projectId", "canonicalUrl", "updatedAt")
    VALUES ('upgrade-repository', 'upgrade-project', 'https://github.com/example/booking', now())`);
  await client.query(`INSERT INTO "RepositorySnapshot"
    (id, "repositoryId", "commitSha", "analyzerVersion", "coverageStatus", "updatedAt")
    VALUES ('upgrade-snapshot', 'upgrade-repository', $1, 'analyzer@0.3.0', 'READY', now())`, [commitSha]);
  await client.query(`INSERT INTO "RepositoryTarget"
    (id, "repositoryId", "targetKey", "requestedRef", "resolvedRefType", "latestObservedCommitSha", "lastObservedAt", "updatedAt")
    VALUES ('upgrade-target', 'upgrade-repository', 'branch:main', 'main', 'BRANCH', $1, now(), now())`, [commitSha]);
  await client.query(`INSERT INTO "CodeArtifact"
    (id, "snapshotId", "artifactKey", name, "artifactType", "filePath", "contentHash", "updatedAt") VALUES
    ('upgrade-test', 'upgrade-snapshot', 'test:booking.spec.ts', 'booking.spec.ts', 'TEST', 'booking.spec.ts', 'old-test-hash', now()),
    ('upgrade-method', 'upgrade-snapshot', 'method:cancel', 'cancel', 'SERVICE_METHOD', 'booking.service.ts', 'old-method-hash', now())`);
  await client.query(`INSERT INTO "DependencyEdge" (id, "snapshotId", "fromArtifactId", "toArtifactId", type)
    VALUES ('upgrade-edge', 'upgrade-snapshot', 'upgrade-test', 'upgrade-method', 'TESTS')`);
  await client.query(`INSERT INTO "Requirement" (id, "projectId", "updatedAt")
    VALUES ('upgrade-requirement', 'upgrade-project', now())`);
  await client.query(`INSERT INTO "RequirementRevision" (id, "requirementId", title, "rawText", "normalizedText", "readinessStatus")
    VALUES ('upgrade-revision', 'upgrade-requirement', 'Cancel paid bookings',
      'Allow paid booking cancellation and refund.', 'Allow paid booking cancellation and refund.', 'READY_FOR_ANALYSIS')`);
  await client.query(`INSERT INTO "ImpactAnalysis"
    (id, "requirementRevisionId", "snapshotId", "sourceTargetId", "requestKey", status, stage, "updatedAt")
    VALUES ('upgrade-analysis', 'upgrade-revision', 'upgrade-snapshot', 'upgrade-target', 'upgrade-request', 'COMPLETED', 'DONE', now())`);
  await client.query(`INSERT INTO reviewed_report_snapshot
    (id, analysis_id, markdown, review_decisions_snapshot, evidence_quality_summary_snapshot)
    VALUES ('upgrade-report', 'upgrade-analysis', $1, '[]'::jsonb, '{}'::jsonb)`, [markdown]);
}

export async function verifyLegacyTestTraceData(client: Client): Promise<string[]> {
  const failures: string[] = [];
  const artifacts = await client.query(`SELECT id, "contentHash", metadata FROM "CodeArtifact"
    WHERE "snapshotId" = 'upgrade-snapshot' ORDER BY id`);
  if (artifacts.rowCount !== 2 || artifacts.rows[0].contentHash !== 'old-method-hash' ||
      artifacts.rows[1].contentHash !== 'old-test-hash' || artifacts.rows.some(row => row.metadata !== null)) {
    failures.push('legacy artifacts lost content identity or received invented test metadata');
  }
  const edge = await client.query(`SELECT "fromArtifactId", "toArtifactId", confidence, metadata FROM "DependencyEdge"
    WHERE id = 'upgrade-edge'`);
  if (edge.rowCount !== 1 || edge.rows[0].fromArtifactId !== 'upgrade-test' ||
      edge.rows[0].toArtifactId !== 'upgrade-method' || edge.rows[0].confidence !== null || edge.rows[0].metadata !== null) {
    failures.push('legacy dependency lost its endpoints or received invented provenance');
  }
  const snapshot = await client.query(`SELECT "commitSha", "analyzerVersion" FROM "RepositorySnapshot" WHERE id = 'upgrade-snapshot'`);
  if (snapshot.rowCount !== 1 || snapshot.rows[0].commitSha !== commitSha || snapshot.rows[0].analyzerVersion !== 'analyzer@0.3.0') {
    failures.push('legacy snapshot identity changed');
  }
  const report = await client.query(`SELECT markdown, review_decisions_snapshot, evidence_quality_summary_snapshot,
    test_trace_snapshot FROM reviewed_report_snapshot WHERE id = 'upgrade-report'`);
  if (report.rowCount !== 1 || report.rows[0].markdown !== markdown || report.rows[0].test_trace_snapshot !== null ||
      JSON.stringify(report.rows[0].review_decisions_snapshot) !== '[]' ||
      JSON.stringify(report.rows[0].evidence_quality_summary_snapshot) !== '{}') {
    failures.push('legacy report content changed or received invented test paths');
  }
  for (const confidence of [-0.1, 1.1]) {
    try {
      await client.query(`UPDATE "DependencyEdge" SET confidence = $1 WHERE id = 'upgrade-edge'`, [confidence]);
      failures.push(`dependency confidence constraint accepted ${confidence}`);
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== '23514') throw error;
    }
  }
  return failures;
}
