import type { ArtifactWithEvidenceBasic } from '../ports/embedding-snapshot.repository.port';

/**
 * Bumped whenever build() text assembly logic changes.
 * All new EmbeddingChunks must persist this value.
 * Old chunks with null/legacy values are NOT reuse-eligible.
 */
export const CHUNK_BUILDER_VERSION = 'artifact-chunker@0.2.0';

export type ArtifactChunkBuilderInput = {
  artifact: Omit<ArtifactWithEvidenceBasic, 'evidences'>;
  evidence?: ArtifactWithEvidenceBasic['evidences'];
};

export type BuiltChunk = {
  stableChunkId: string;
  chunkType: string;
  content: string;
  chunkerVersion: string;
};

export class ArtifactChunkBuilder {
  static build(input: ArtifactChunkBuilderInput): BuiltChunk {
    const chunkType = ArtifactChunkBuilder.mapArtifactType(input.artifact.artifactType);

    // Only embed a real code excerpt. A placeholder ("no snippet available")
    // carries zero semantic signal and makes every evidence-less artifact cluster
    // together in the vector space, which hurts recall precision — so omit it.
    const excerpt =
      input.evidence && input.evidence.length > 0 ? input.evidence[0].excerpt : null;

    const lines = [
      `artifactKey: ${input.artifact.artifactKey}`,
      `symbol: ${input.artifact.name}`,
      `type: ${input.artifact.artifactType}`,
      `file: ${input.artifact.filePath}`,
    ];
    if (excerpt) {
      lines.push('excerpt:', excerpt);
    }
    const content = lines.join('\n');

    const stableChunkId = `${input.artifact.snapshotId}:${input.artifact.artifactKey}:${chunkType}`;

    return {
      stableChunkId,
      chunkType,
      content,
      chunkerVersion: CHUNK_BUILDER_VERSION,
    };
  }

  private static mapArtifactType(artifactType: string): string {
    switch (artifactType) {
      case 'SERVICE_METHOD':
      case 'API_ROUTE':
        return 'METHOD_BODY';
      case 'ENTITY':
        return 'ENTITY_CONTEXT';
      case 'TEST':
        return 'TEST_CASE';
      case 'CLASS':
      case 'SERVICE':
        return 'CLASS_CONTEXT';
      default:
        return 'ARTIFACT_SUMMARY';
    }
  }
}
