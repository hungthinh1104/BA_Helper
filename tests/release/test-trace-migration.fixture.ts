import type { Client } from 'pg';

const commitSha = 'b'.repeat(40);
const markdown = '# Historical reviewed report\n';

/** SQL intentionally omits all new columns: these rows predate test-trace support. */
export async function seedLegacyTestTraceData(client: Client): Promise<void> {
  const columns = await client.query(`SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND ((table_name = 'DependencyEdge' AND column_name IN ('confidence', 'metadata'))
      OR (table_name = 'CodeArtifact' AND column_name = 'metadata')
      OR (table_name = 'reviewed_report_snapshot' AND column_name = 'test_trace_snapshot')
      OR (table_name = 'reviewed_report_snapshot' AND column_name = 'approved_document_analysis_id')
      OR (table_name = 'GeneratedDocument' AND column_name = 'reviewed_report_snapshot_id')
      OR (table_name = 'document_job' AND column_name = 'generated_document_analysis_id'))`);
  if (columns.rowCount !== 0) throw new Error('Legacy schema already contains post-upgrade report or test-trace columns.');
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
  await client.query(`INSERT INTO "ImpactAnalysis"
    (id, "requirementRevisionId", "snapshotId", "sourceTargetId", "requestKey", status, stage, "updatedAt")
    VALUES ('upgrade-other-analysis', 'upgrade-revision', 'upgrade-snapshot', 'upgrade-target', 'upgrade-request-other', 'COMPLETED', 'DONE', now())`);
  await client.query(`INSERT INTO "GeneratedDocument"
    (id, "impactAnalysisId", type, status, content, "createdAt", "updatedAt")
    VALUES ('upgrade-document', 'upgrade-analysis', 'IMPACT_REPORT', 'APPROVED', $1, now(), now())`, [markdown]);
  await client.query(`INSERT INTO reviewed_report_snapshot
    (id, analysis_id, approved_document_id, markdown, review_decisions_snapshot, evidence_quality_summary_snapshot)
    VALUES
      ('upgrade-report', 'upgrade-analysis', 'upgrade-document', $1, '[]'::jsonb, '{}'::jsonb),
      ('upgrade-report-older', 'upgrade-analysis', 'upgrade-document', $1, '[]'::jsonb, '{}'::jsonb)`, [markdown]);
  await client.query(`INSERT INTO document_job
    (id, analysis_id, snapshot_id, document_type, status, generated_document_id, created_at, updated_at)
    VALUES ('upgrade-document-job', 'upgrade-analysis', 'upgrade-report', 'IMPACT_REPORT', 'COMPLETED',
      'upgrade-document', now(), now())`);
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
  failures.push(...await verifyDependencyEdgeSnapshotScope(client));
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
  const legacyDocument = await client.query(`SELECT content, reviewed_report_snapshot_id FROM "GeneratedDocument"
    WHERE id = 'upgrade-document'`);
  if (legacyDocument.rowCount !== 1 || legacyDocument.rows[0].content !== markdown ||
      legacyDocument.rows[0].reviewed_report_snapshot_id !== null) {
    failures.push('legacy generated report changed or was assigned ambiguous snapshot provenance');
  }
  const documentJob = await client.query(`SELECT analysis_id, snapshot_id, generated_document_id,
      generated_document_analysis_id
    FROM document_job WHERE id = 'upgrade-document-job'`);
  if (documentJob.rowCount !== 1 || documentJob.rows[0].analysis_id !== 'upgrade-analysis' ||
      documentJob.rows[0].snapshot_id !== 'upgrade-report' ||
      documentJob.rows[0].generated_document_id !== 'upgrade-document' ||
      documentJob.rows[0].generated_document_analysis_id !== 'upgrade-analysis') {
    failures.push('legacy document-job report identity or analysis provenance changed during upgrade');
  }
  const documentJobScopeConstraint = await client.query(`SELECT convalidated FROM pg_constraint
    WHERE conrelid = 'document_job'::regclass
      AND conname = 'document_job_generated_document_analysis_scope_fkey'`);
  if (documentJobScopeConstraint.rowCount !== 1 || !documentJobScopeConstraint.rows[0].convalidated) {
    failures.push('same-analysis document-job report foreign key is missing or unvalidated');
  }
  const legacyDocumentLinks = await client.query(`SELECT count(*)::int AS count FROM reviewed_report_snapshot
    WHERE approved_document_id = 'upgrade-document'`);
  if (legacyDocumentLinks.rows[0]?.count !== 2) {
    failures.push('legacy report snapshots no longer retain their shared document link');
  }
  const scopedLegacyDocumentLinks = await client.query(`SELECT approved_document_analysis_id
    FROM reviewed_report_snapshot WHERE approved_document_id = 'upgrade-document'`);
  if (scopedLegacyDocumentLinks.rowCount !== 2 ||
      scopedLegacyDocumentLinks.rows.some((row) => row.approved_document_analysis_id !== 'upgrade-analysis')) {
    failures.push('legacy shared report links did not retain their matching analysis identity');
  }
  const approvedDocumentScopeConstraint = await client.query(`SELECT convalidated FROM pg_constraint
    WHERE conrelid = 'reviewed_report_snapshot'::regclass
      AND conname = 'reviewed_report_snapshot_approved_document_id_analysis_id_fkey'`);
  if (approvedDocumentScopeConstraint.rowCount !== 1 || !approvedDocumentScopeConstraint.rows[0].convalidated) {
    failures.push('approved-document analysis foreign key is missing or unvalidated');
  }
  const snapshotDocumentUnique = await client.query(
    `SELECT to_regclass('"GeneratedDocument_reviewedReportSnapshotId_type_status_key"') AS idx`,
  );
  if (!snapshotDocumentUnique.rows[0].idx) {
    failures.push('snapshot-scoped generated-document unique index missing after upgrade');
  }
  const snapshotAnalysisKey = await client.query(
    `SELECT to_regclass('reviewed_report_snapshot_id_analysis_id_key') AS idx`,
  );
  if (!snapshotAnalysisKey.rows[0].idx) {
    failures.push('reviewed snapshot composite identity index missing after upgrade');
  }
  const legacyDocumentUnique = await client.query(
    `SELECT to_regclass('"GeneratedDocument_legacy_identity_key"') AS idx`,
  );
  if (!legacyDocumentUnique.rows[0].idx) {
    failures.push('legacy null-snapshot generated-document identity index missing after upgrade');
  }
  try {
    await client.query(`INSERT INTO "GeneratedDocument"
      (id, "impactAnalysisId", type, status, content, "createdAt", "updatedAt")
      VALUES ('upgrade-duplicate-legacy-document', 'upgrade-analysis',
        'IMPACT_REPORT', 'APPROVED', '# Duplicate legacy document', now(), now())`);
    failures.push('same-analysis legacy generated documents with a null snapshot accepted a duplicate identity');
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown';
    if (code !== '23505') {
      throw new Error(`Expected duplicate legacy report to fail with 23505, received ${code}.`);
    }
  }
  await client.query(`INSERT INTO "GeneratedDocument"
    (id, "impactAnalysisId", type, status, content, "createdAt", "updatedAt")
    VALUES ('upgrade-other-document', 'upgrade-other-analysis', 'IMPACT_REPORT', 'APPROVED', '# Other analysis', now(), now())`);
  try {
    await client.query(`UPDATE document_job
      SET generated_document_id = 'upgrade-other-document', generated_document_analysis_id = 'upgrade-analysis'
      WHERE id = 'upgrade-document-job'`);
    failures.push('document job accepted an approved document from another analysis');
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown';
    if (code !== '23503') {
      throw new Error(`Expected cross-analysis document-job report link to fail with 23503, received ${code}.`);
    }
  }
  await client.query(`INSERT INTO "GeneratedDocument"
    (id, "impactAnalysisId", type, status, content, "createdAt", "updatedAt")
    VALUES ('upgrade-delete-document', 'upgrade-analysis', 'IMPACT_REPORT', 'DRAFT', '# Delete behavior', now(), now())`);
  await client.query(`UPDATE document_job
    SET generated_document_id = 'upgrade-delete-document', generated_document_analysis_id = 'upgrade-analysis'
    WHERE id = 'upgrade-document-job'`);
  await client.query(`DELETE FROM "GeneratedDocument" WHERE id = 'upgrade-delete-document'`);
  const clearedDocumentJob = await client.query(`SELECT generated_document_id, generated_document_analysis_id
    FROM document_job WHERE id = 'upgrade-document-job'`);
  if (clearedDocumentJob.rowCount !== 1 || clearedDocumentJob.rows[0].generated_document_id !== null ||
      clearedDocumentJob.rows[0].generated_document_analysis_id !== null) {
    failures.push('deleting a generated report did not clear both document-job report identity fields');
  }
  try {
    await client.query(`UPDATE reviewed_report_snapshot
      SET approved_document_id = 'upgrade-other-document', approved_document_analysis_id = 'upgrade-analysis'
      WHERE id = 'upgrade-report'`);
    failures.push('reviewed snapshot accepted an approved document from another analysis');
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown';
    if (code !== '23503') throw new Error(`Expected cross-analysis snapshot link to fail with 23503, received ${code}.`);
  }
  const originalApprovedDocument = await client.query(`SELECT approved_document_id
    FROM reviewed_report_snapshot WHERE id = 'upgrade-report'`);
  if (originalApprovedDocument.rows[0]?.approved_document_id !== 'upgrade-document') {
    failures.push('rejected cross-analysis link changed the legacy approved document');
  }
  for (const [documentId, snapshotId] of [
    ['upgrade-new-document', 'upgrade-report'],
    ['upgrade-new-document-older', 'upgrade-report-older'],
  ]) {
    try {
      await client.query(`INSERT INTO "GeneratedDocument"
        (id, "impactAnalysisId", reviewed_report_snapshot_id, type, status, content, "createdAt", "updatedAt")
        VALUES ($1, 'upgrade-analysis', $2, 'IMPACT_REPORT', 'APPROVED', $3, now(), now())`,
      [documentId, snapshotId, `# ${documentId}`]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'database error';
      throw new Error(`Could not insert snapshot document ${documentId} for ${snapshotId}: ${message}`);
    }
  }
  try {
    await client.query(`INSERT INTO "GeneratedDocument"
      (id, "impactAnalysisId", reviewed_report_snapshot_id, type, status, content, "createdAt", "updatedAt")
      VALUES ('upgrade-duplicate-document', 'upgrade-analysis', 'upgrade-report',
        'IMPACT_REPORT', 'APPROVED', '# Duplicate', now(), now())`);
    failures.push('same reviewed snapshot accepted duplicate approved report documents');
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : 'unknown';
    if (code !== '23505') throw new Error(`Expected duplicate report to fail with 23505, received ${code}.`);
  }
  try {
    await client.query(`INSERT INTO "GeneratedDocument"
      (id, "impactAnalysisId", reviewed_report_snapshot_id, type, status, content, "createdAt", "updatedAt")
      VALUES ('upgrade-cross-analysis-document', 'upgrade-other-analysis', 'upgrade-report',
        'IMPACT_REPORT', 'DRAFT', '# Invalid cross-analysis link', now(), now())`);
    failures.push('generated document accepted a reviewed snapshot from another analysis');
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : 'unknown';
    if (code !== '23503') throw new Error(`Expected cross-analysis report to fail with 23503, received ${code}.`);
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

async function verifyDependencyEdgeSnapshotScope(client: Client): Promise<string[]> {
  const failures: string[] = [];
  const constraints = await client.query(`SELECT conname, convalidated FROM pg_constraint
    WHERE conrelid = '"DependencyEdge"'::regclass
      AND conname IN ('DependencyEdge_fromArtifactId_snapshotId_fkey', 'DependencyEdge_toArtifactId_snapshotId_fkey')`);
  if (constraints.rowCount !== 2 || constraints.rows.some((constraint) => !constraint.convalidated)) {
    failures.push('snapshot-scoped dependency foreign keys are missing or unvalidated');
  }

  await client.query(`INSERT INTO "RepositorySnapshot"
    (id, "repositoryId", "commitSha", "analyzerVersion", "coverageStatus", "updatedAt")
    VALUES ('upgrade-foreign-snapshot', 'upgrade-repository', $1, 'analyzer@0.3.0', 'READY', now())`, ['c'.repeat(40)]);
  await client.query(`INSERT INTO "CodeArtifact"
    (id, "snapshotId", "artifactKey", name, "artifactType", "filePath", "contentHash", "updatedAt")
    VALUES ('upgrade-foreign-artifact', 'upgrade-foreign-snapshot', 'method:foreign', 'foreign',
      'SERVICE_METHOD', 'foreign.service.ts', 'foreign-hash', now())`);

  for (const [edgeId, fromArtifactId, toArtifactId, endpoint] of [
    ['upgrade-cross-snapshot-from', 'upgrade-foreign-artifact', 'upgrade-method', 'from'],
    ['upgrade-cross-snapshot-to', 'upgrade-test', 'upgrade-foreign-artifact', 'to'],
  ]) {
    try {
      await client.query(`INSERT INTO "DependencyEdge" (id, "snapshotId", "fromArtifactId", "toArtifactId", type)
        VALUES ($1, 'upgrade-snapshot', $2, $3, 'TESTS')`, [edgeId, fromArtifactId, toArtifactId]);
      failures.push(`dependency edge accepted a cross-snapshot ${endpoint} endpoint`);
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown';
      if (code !== '23503') {
        throw new Error(`Expected cross-snapshot ${endpoint} endpoint to fail with 23503, received ${code}.`);
      }
    }
  }

  const rejectedEdges = await client.query(`SELECT count(*)::int AS count FROM "DependencyEdge"
    WHERE id IN ('upgrade-cross-snapshot-from', 'upgrade-cross-snapshot-to')`);
  if (rejectedEdges.rows[0]?.count !== 0) failures.push('cross-snapshot dependency rows were persisted');
  return failures;
}
