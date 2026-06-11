import { describe, it, expect } from '@jest/globals';
import { ArtifactChunkBuilder } from '../../apps/api/src/modules/embedding/domain/artifact-chunk.builder';
import { CodeArtifact, Evidence } from '@prisma/client';

describe('ArtifactChunkBuilder', () => {
  const baseArtifact: Partial<CodeArtifact> = {
    snapshotId: 'snap-1',
    artifactKey: 'some.file.ts::method',
    name: 'someMethod',
    filePath: 'some.file.ts',
  };

  const evidence: Partial<Evidence>[] = [
    { excerpt: 'function someMethod() { return true; }' }
  ];

  it('maps SERVICE_METHOD to METHOD_BODY', () => {
    const chunk = ArtifactChunkBuilder.build({
      artifact: { ...baseArtifact, artifactType: 'SERVICE_METHOD' } as CodeArtifact,
      evidence: evidence as Evidence[],
    });

    expect(chunk.chunkType).toBe('METHOD_BODY');
    expect(chunk.stableChunkId).toBe('snap-1:some.file.ts::method:METHOD_BODY');
    expect(chunk.content).toContain('type: SERVICE_METHOD');
    expect(chunk.content).toContain('function someMethod() { return true; }');
  });

  it('maps ENTITY to ENTITY_CONTEXT', () => {
    const chunk = ArtifactChunkBuilder.build({
      artifact: { ...baseArtifact, artifactType: 'ENTITY' } as CodeArtifact,
      evidence: evidence as Evidence[],
    });

    expect(chunk.chunkType).toBe('ENTITY_CONTEXT');
  });

  it('maps TEST to TEST_CASE', () => {
    const chunk = ArtifactChunkBuilder.build({
      artifact: { ...baseArtifact, artifactType: 'TEST' } as CodeArtifact,
      evidence: evidence as Evidence[],
    });

    expect(chunk.chunkType).toBe('TEST_CASE');
  });

  it('maps unmapped types to ARTIFACT_SUMMARY', () => {
    const chunk = ArtifactChunkBuilder.build({
      artifact: { ...baseArtifact, artifactType: 'WEIRD_TYPE' } as CodeArtifact,
      evidence: evidence as Evidence[],
    });

    expect(chunk.chunkType).toBe('ARTIFACT_SUMMARY');
  });

  it('generates summary when evidence is missing', () => {
    const chunk = ArtifactChunkBuilder.build({
      artifact: { ...baseArtifact, artifactType: 'SERVICE_METHOD' } as CodeArtifact,
      evidence: [],
    });

    expect(chunk.content).toContain('No code snippet available for someMethod');
  });
});
