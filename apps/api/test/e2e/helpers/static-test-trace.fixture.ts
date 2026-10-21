import { createHash, randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { Client } from 'pg';
import { dependencyEdgeProvenanceSchema, testCaseMetadataSchema } from '@ba-helper/contracts';

export const traceCaseTitle = 'cancels a paid booking once';
const sourcePath = 'src/booking/booking.service.spec.ts';
const suitePath = ['BookingService.cancelBooking'];
const hash = (text: string) => createHash('sha256').update(text).digest('hex');

async function withDatabase<T>(run: (client: Client) => Promise<T>): Promise<T> {
  config({ path: '.env', quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the browser test fixture.');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try { return await run(client); } finally { await client.end(); }
}

/** Synthetic persisted browser fixture; scanner correctness is covered by production-graph E2E. */
export async function seedTestTrace(analysisId: string, options: { parameterized?: boolean } = {}) {
  const declaration = options.parameterized ? 'it.each([true, false])' : 'it';
  const excerpt = `${declaration}('${traceCaseTitle}', async () => {\n  await service.cancelBooking();\n});`;
  return withDatabase(async client => {
    const result = await client.query<{ snapshotId: string; artifactId: string }>(`
      SELECT a."snapshotId", c.id AS "artifactId" FROM "ImpactAnalysis" a
      JOIN "RepositorySnapshot" s ON s.id = a."snapshotId"
      JOIN "Repository" r ON r.id = s."repositoryId"
      JOIN "CodeArtifact" c ON c."snapshotId" = s.id
      WHERE a.id = $1 AND a."requestKey" = 'demo-analysis-scenario-a'
        AND r."canonicalUrl" = 'demo://booking-cancellation'
        AND c."artifactKey" = 'api:booking.service.cancelBooking'`, [analysisId]);
    if (result.rowCount !== 1) throw new Error('Expected the isolated demo booking artifact.');
    const { snapshotId, artifactId } = result.rows[0];
    const fileKey = `test:${sourcePath.replace(/[/\\]/g, '.')}`;
    const caseKey = `test-case:${sourcePath}::${hash(JSON.stringify([
      suitePath, traceCaseTitle, ...(options.parameterized ? ['PARAMETERIZED'] : []),
    ]))}`;
    const caseId = randomUUID(), edgeId = randomUUID();
    const provenanceKey = `snapshot:${snapshotId}:artifact:${caseKey}`;
    const testCase = testCaseMetadataSchema.parse({ framework: 'jest', suitePath,
      title: traceCaseTitle, modifier: 'NORMAL', declaredModifier: 'NORMAL', parentFileArtifactKey: fileKey,
      ...(options.parameterized ? { parameterized: true } : {}) });
    const provenance = dependencyEdgeProvenanceSchema.parse({ kind: 'STATIC_SOURCE_REFERENCE',
      resolver: 'TS_AST_DIRECT_CALL', evidenceProvenanceKey: provenanceKey,
      locations: [{ sourcePath, startLine: 3, endLine: 3 }] });
    await client.query('BEGIN');
    try {
      await client.query(`INSERT INTO "CodeArtifact"
        (id, "snapshotId", "artifactKey", name, "artifactType", universal_kind, "filePath", "startLine", "endLine", "contentHash", metadata, "updatedAt")
        VALUES ($1, $2, $3, 'booking.service.spec.ts', 'TEST', 'TEST_FILE', $4, 1, 5, $5, NULL, now()),
          ($6, $2, $7, $8, 'JEST_TEST_CASE', 'TEST_CASE', $4, 2, 4, $9, $10::jsonb, now())`,
      [randomUUID(), snapshotId, fileKey, sourcePath, hash(`describe('${suitePath[0]}', () => {\n${excerpt}\n});`),
        caseId, caseKey, `${suitePath[0]} > ${traceCaseTitle}`, hash(excerpt), JSON.stringify({ testCase })]);
      await client.query(`INSERT INTO "Evidence"
        (id, "provenanceKey", "sourceType", "snapshotId", "artifactId", "sourcePath", "startLine", "endLine", excerpt, "contentHash")
        VALUES ($1, $2, 'TEST', $3, $4, $5, 2, 4, $6, $7)`,
      [randomUUID(), provenanceKey, snapshotId, caseId, sourcePath, excerpt, hash(excerpt)]);
      await client.query(`INSERT INTO "DependencyEdge"
        (id, "snapshotId", "fromArtifactId", "toArtifactId", type, confidence, metadata)
        VALUES ($1, $2, $3, $4, 'TESTS', 1, $5::jsonb)`, [edgeId, snapshotId, caseId, artifactId, JSON.stringify(provenance)]);
      await client.query('COMMIT');
      return { edgeId, snapshotId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

/** Simulate a changed live graph after finalization to verify the saved report remains stable. */
export async function removeLiveTestTrace(trace: { edgeId: string; snapshotId: string }) {
  await withDatabase(async client => {
    await client.query('DELETE FROM "DependencyEdge" WHERE id = $1 AND "snapshotId" = $2', [trace.edgeId, trace.snapshotId]);
  });
}
