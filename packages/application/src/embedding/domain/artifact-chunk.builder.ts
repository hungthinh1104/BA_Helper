import type { ArtifactWithEvidenceBasic } from '../ports/embedding-snapshot.repository.port';

/**
 * Bumped whenever build() text assembly logic changes.
 * All new EmbeddingChunks must persist this value.
 * Old chunks with null/legacy values are NOT reuse-eligible.
 */
export const CHUNK_BUILDER_VERSION = 'artifact-chunker@0.1.0';

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
    
    // Attempt to use evidence excerpt if available
    let excerpt = '';
    if (input.evidence && input.evidence.length > 0) {
       // Ideally use the primary evidence for the artifact
       excerpt = input.evidence[0].excerpt;
    } else {
       // If no evidence is provided, we must rely on what was persisted, but the current design states 
       // excerpt is generated and stored in Evidence. Since we are refactoring to persist excerpt in artifact or evidence,
       // and my earlier search showed it's in Evidence, we'll format a summary if excerpt is missing.
       excerpt = `No code snippet available for ${input.artifact.name}`;
    }

    const content = [
      `artifactKey: ${input.artifact.artifactKey}`,
      `symbol: ${input.artifact.name}`,
      `type: ${input.artifact.artifactType}`,
      `file: ${input.artifact.filePath}`,
      `excerpt:`,
      excerpt
    ].join('\n');

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
