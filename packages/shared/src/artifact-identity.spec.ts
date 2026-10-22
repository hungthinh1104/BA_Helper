import { createArtifactIdentity } from './artifact-identity';

describe('createArtifactIdentity', () => {
  it('normalizes separators and dot segments before encoding a repository path', () => {
    expect(createArtifactIdentity('service', 'src\\booking\\.\\payment.ts', 'PaymentService.refund'))
      .toBe(createArtifactIdentity('service', 'src/booking/payment.ts', 'PaymentService.refund'));
  });

  it('distinguishes duplicate symbol names in different repository paths', () => {
    expect(createArtifactIdentity('service', 'src/payment.ts', 'PaymentService.refund'))
      .not.toBe(createArtifactIdentity('service', 'src/refund.ts', 'PaymentService.refund'));
  });

  it('rejects absolute paths and paths that escape the repository root', () => {
    expect(() => createArtifactIdentity('service', 'C:\\repo\\src\\payment.ts', 'PaymentService.refund'))
      .toThrow('repository-relative');
    expect(() => createArtifactIdentity('service', '../payment.ts', 'PaymentService.refund'))
      .toThrow('escape the repository root');
  });
});
