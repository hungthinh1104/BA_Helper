import { GetTestTraceEvidenceUseCase } from './get-test-trace-evidence.usecase';
import { staticTestTraceFixture, traceIds } from '../../../../../../../tests/fixtures/static-test-trace.fixture';
import type { GetQaCoverageUseCase } from './get-qa-coverage.usecase';
import type { QaTraceRepository } from '../../infrastructure/qa-trace.repository';

describe('test trace evidence read', () => {
  const projection = staticTestTraceFixture();
  const coverage = { execute: jest.fn().mockResolvedValue(projection) };
  const repository = { findEvidence: jest.fn().mockResolvedValue({ id: traceIds.evidence, snapshotId: traceIds.snapshot,
    artifactId: traceIds.test, provenanceKey: `snapshot:${traceIds.snapshot}:artifact:test-case:refund`,
    sourceType: 'TEST', sourcePath: 'src/payment.spec.ts', startLine: 3, endLine: 8, excerpt: 'redacted source' }) };
  const useCase = new GetTestTraceEvidenceUseCase(coverage as unknown as GetQaCoverageUseCase, repository as unknown as QaTraceRepository);

  beforeEach(() => jest.clearAllMocks());

  it('reads proof from a selected path using the analysis snapshot identity', async () => {
    const result = await useCase.execute(traceIds.analysis, traceIds.evidence);
    expect(repository.findEvidence).toHaveBeenCalledWith(traceIds.snapshot, traceIds.evidence);
    expect(result).toMatchObject({ snapshotId: traceIds.snapshot, commitSha: 'a'.repeat(40), evidence: { excerpt: 'redacted source' } });
  });

  it('does not expose arbitrary same-snapshot evidence outside the returned test paths', async () => {
    expect(await useCase.execute(traceIds.analysis, 'unrelated')).toBeNull();
    expect(repository.findEvidence).not.toHaveBeenCalled();
  });

  it('rejects evidence whose persisted origin disagrees with the saved path', async () => {
    repository.findEvidence.mockResolvedValueOnce({ ...(await repository.findEvidence()), artifactId: traceIds.code });
    expect(await useCase.execute(traceIds.analysis, traceIds.evidence)).toBeNull();
  });
  it('rejects changed source locators instead of displaying a mismatched excerpt', async () => {
    repository.findEvidence.mockResolvedValueOnce({ ...(await repository.findEvidence()), sourcePath: 'other.ts' });
    expect(await useCase.execute(traceIds.analysis, traceIds.evidence)).toBeNull();
  });
});
