import { ArtifactChunkBuilder, CHUNK_BUILDER_VERSION } from '../domain/artifact-chunk.builder';

describe('ArtifactChunkBuilder', () => {
  const baseArtifact = {
    id: 'artifact-1',
    snapshotId: 'snapshot-1',
    artifactKey: 'api:booking.controller.cancel',
    name: 'BookingController.cancel',
    artifactType: 'API_ROUTE',
    universalKind: 'API_ROUTE',
    filePath: 'src/booking/booking.controller.ts',
    startLine: 10,
    endLine: 20,
    language: null,
    contentHash: 'abc123',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  it('includes CHUNK_BUILDER_VERSION in built chunk', () => {
    const chunk = ArtifactChunkBuilder.build({ artifact: baseArtifact });
    expect(chunk.chunkerVersion).toBe(CHUNK_BUILDER_VERSION);
  });

  it('CHUNK_BUILDER_VERSION matches expected constant value', () => {
    expect(CHUNK_BUILDER_VERSION).toBe('artifact-chunker@0.2.0');
  });

  it('stableChunkId includes snapshotId and artifactKey', () => {
    const chunk = ArtifactChunkBuilder.build({ artifact: baseArtifact });
    expect(chunk.stableChunkId).toContain('snapshot-1');
    expect(chunk.stableChunkId).toContain('api:booking.controller.cancel');
  });

  it('maps API_ROUTE artifactType to METHOD_BODY chunkType', () => {
    const chunk = ArtifactChunkBuilder.build({ artifact: baseArtifact });
    expect(chunk.chunkType).toBe('METHOD_BODY');
  });

  it('uses evidence excerpt when available', () => {
    const evidence = [{ excerpt: 'cancel() { return refund; }' }] as any[];
    const chunk = ArtifactChunkBuilder.build({ artifact: baseArtifact, evidence });
    expect(chunk.content).toContain('cancel() { return refund; }');
  });

  it('omits the placeholder and embeds only metadata when no evidence is provided', () => {
    const chunk = ArtifactChunkBuilder.build({ artifact: baseArtifact });
    expect(chunk.content).not.toContain('No code snippet available');
    expect(chunk.content).toContain('BookingController.cancel');
    expect(chunk.content).not.toContain('excerpt:');
  });

  it('returns all required fields in BuiltChunk', () => {
    const chunk = ArtifactChunkBuilder.build({ artifact: baseArtifact });
    expect(chunk).toHaveProperty('stableChunkId');
    expect(chunk).toHaveProperty('chunkType');
    expect(chunk).toHaveProperty('content');
    expect(chunk).toHaveProperty('chunkerVersion');
  });
});
