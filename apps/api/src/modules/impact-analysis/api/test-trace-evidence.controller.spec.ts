import { NotFoundException } from '@nestjs/common';
import { TestTraceEvidenceController } from './test-trace-evidence.controller';
import type { RequestUser } from '@ba-helper/contracts';

describe('test trace evidence permission boundary', () => {
  const actor = { id: 'viewer', role: 'VIEWER' } as RequestUser;
  const evidence = { execute: jest.fn() }, permissions = { assertCanReadAnalysis: jest.fn() };
  const controller = new TestTraceEvidenceController(evidence as any, permissions as any);
  beforeEach(() => jest.resetAllMocks());

  it('checks project access before any trace/source read', async () => {
    permissions.assertCanReadAnalysis.mockRejectedValue(new NotFoundException());
    await expect(controller.get('foreign-analysis', 'evidence', actor)).rejects.toThrow(NotFoundException);
    expect(evidence.execute).not.toHaveBeenCalled();
  });
  it('does not disclose an evidence ID outside the authorized source paths', async () => {
    evidence.execute.mockResolvedValue(null);
    await expect(controller.get('analysis', 'unrelated', actor)).rejects.toThrow(NotFoundException);
    expect(permissions.assertCanReadAnalysis).toHaveBeenCalledWith(actor, 'analysis');
  });
});
