import { createHash } from 'node:crypto';
import { AiPolicy } from '../../ai/domain/ai.policy';

export const EmbeddingPolicy = {
  /** Build text content from an artifact for embedding */
  buildArtifactContent(artifact: {
    artifactType: string;
    name: string;
    filePath: string;
    symbolName?: string | null;
  }): string {
    const parts = [
      `[${artifact.artifactType}] ${artifact.name}`,
      `File: ${artifact.filePath}`,
    ];
    if (artifact.symbolName) {
      parts.push(`Symbol: ${artifact.symbolName}`);
    }
    return parts.join('\n');
  },

  /** Compute content hash for cache comparison */
  computeContentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  },

  /** Redact secrets before embedding */
  redactForEmbedding(content: string): string {
    const { redactedPayload } = AiPolicy.redactPayload(content);
    return redactedPayload;
  },

  /** Rough token count estimate (1 token ≈ 4 chars for English/code) */
  estimateTokenCount(content: string): number {
    return Math.ceil(content.length / 4);
  },
};
