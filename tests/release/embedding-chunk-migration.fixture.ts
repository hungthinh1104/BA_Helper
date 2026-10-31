import type { Client } from 'pg';

const commitSha = 'b'.repeat(40);
const chunkId = 'upgrade-embedding-chunk';
const constraintNames = [
  'EmbeddingChunk_tenantId_projectId_check',
  'EmbeddingChunk_repositoryId_projectId_fkey',
  'EmbeddingChunk_snapshotId_repositoryId_commitSha_fkey',
  'EmbeddingChunk_artifactId_snapshotId_fkey',
];

export async function seedLegacyEmbeddingChunk(client: Client): Promise<void> {
  const vector = `[1${',0'.repeat(1535)}]`;
  await client.query(`INSERT INTO "EmbeddingChunk" (
    id, "tenantId", "projectId", "repositoryId", "snapshotId", "artifactId",
    "stableChunkId", "commitSha", "filePath", "symbolName", "artifactType",
    content, "contentHash", "tokenCount", "embeddingModel", embedding
  ) VALUES (
    $1, 'upgrade-project', 'upgrade-project', 'upgrade-repository', 'upgrade-snapshot',
    'upgrade-method', 'upgrade-method:hash', $2, 'booking.service.ts', 'cancel',
    'SERVICE_METHOD', 'synthetic historical embedding content', 'upgrade-content-hash',
    4, 'text-embedding-3-small', $3::vector
  )`, [chunkId, commitSha, vector]);
}

export async function verifyLegacyEmbeddingChunk(client: Client): Promise<string[]> {
  const failures: string[] = [];
  const row = await client.query(`SELECT "tenantId", "projectId", "repositoryId",
    "snapshotId", "artifactId", "commitSha", content FROM "EmbeddingChunk" WHERE id = $1`,
  [chunkId]);
  if (row.rowCount !== 1 || row.rows[0].tenantId !== 'upgrade-project' ||
      row.rows[0].projectId !== 'upgrade-project' || row.rows[0].repositoryId !== 'upgrade-repository' ||
      row.rows[0].snapshotId !== 'upgrade-snapshot' || row.rows[0].artifactId !== 'upgrade-method' ||
      row.rows[0].commitSha !== commitSha || row.rows[0].content !== 'synthetic historical embedding content') {
    failures.push('valid historical embedding chunk identity or content was not preserved');
  }

  const constraints = await client.query(`SELECT conname FROM pg_constraint
    WHERE conname = ANY($1::text[]) AND convalidated`, [constraintNames]);
  if (constraints.rowCount !== constraintNames.length) {
    failures.push('embedding provenance constraints are missing or unvalidated after upgrade');
  }
  return failures;
}
