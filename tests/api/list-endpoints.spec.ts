import { evidenceListResponseSchema } from '../../packages/contracts/src/evidence.contract';
import { insightListResponseSchema } from '../../packages/contracts/src/insight.contract';
import { traceabilityLinkListResponseSchema } from '../../packages/contracts/src/traceability.contract';
import { documentListResponseSchema } from '../../packages/contracts/src/document.contract';

describe('contract schemas', () => {
  it('validates evidence list shape', () => {
    const payload = { items: [] };
    expect(() => evidenceListResponseSchema.parse(payload)).not.toThrow();
  });

  it('validates insight list shape', () => {
    const payload = { items: [] };
    expect(() => insightListResponseSchema.parse(payload)).not.toThrow();
  });

  it('validates traceability list shape', () => {
    const payload = { items: [] };
    expect(() => traceabilityLinkListResponseSchema.parse(payload)).not.toThrow();
  });

  it('validates document list shape', () => {
    const payload = { items: [] };
    expect(() => documentListResponseSchema.parse(payload)).not.toThrow();
  });
});
