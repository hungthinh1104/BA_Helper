import { EmbeddingPolicy } from '../../apps/api/src/modules/embedding/domain/embedding.policy';
import { AiPolicy } from '@ba-helper/shared';

describe('EmbeddingPolicy', () => {
  describe('buildArtifactContent', () => {
    it('should combine artifact details into a searchable string', () => {
      const artifact = {
        artifactType: 'SERVICE_METHOD',
        name: 'cancelBooking',
        filePath: 'src/booking.service.ts',
        symbolName: 'cancelBooking',
      };
      
      const content = EmbeddingPolicy.buildArtifactContent(artifact);
      
      expect(content).toContain('[SERVICE_METHOD] cancelBooking');
      expect(content).toContain('File: src/booking.service.ts');
      expect(content).toContain('Symbol: cancelBooking');
    });

    it('should omit symbol if not present', () => {
      const artifact = {
        artifactType: 'FILE',
        name: 'utils.ts',
        filePath: 'src/utils.ts',
      };
      
      const content = EmbeddingPolicy.buildArtifactContent(artifact);
      
      expect(content).toContain('[FILE] utils.ts');
      expect(content).toContain('File: src/utils.ts');
      expect(content).not.toContain('Symbol:');
    });
  });

  describe('computeContentHash', () => {
    it('should generate a consistent sha256 hash', () => {
      const content = 'test content';
      const hash1 = EmbeddingPolicy.computeContentHash(content);
      const hash2 = EmbeddingPolicy.computeContentHash(content);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // sha256 hex length
    });
  });

  describe('redactForEmbedding', () => {
    it('should use AiPolicy to redact secrets', () => {
      // Basic test to ensure it delegates to AiPolicy
      const originalPayload = 'apiKey: "sk-1234567890abcdef1234567890abcdef"';
      const redacted = EmbeddingPolicy.redactForEmbedding(originalPayload);
      expect(redacted).not.toContain('sk-1234567890abcdef1234567890abcdef');
      expect(redacted).toContain('[REDACTED]');
    });
  });

  describe('estimateTokenCount', () => {
    it('should estimate tokens by dividing by 4', () => {
      const text = '1234';
      expect(EmbeddingPolicy.estimateTokenCount(text)).toBe(1);
      
      const text2 = '12345';
      expect(EmbeddingPolicy.estimateTokenCount(text2)).toBe(2);
    });
  });
});
