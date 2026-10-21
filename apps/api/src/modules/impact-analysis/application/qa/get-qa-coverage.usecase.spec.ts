import { GetQaCoverageUseCase } from './get-qa-coverage.usecase';
import { QaCoverageDeriver } from './qa-coverage.deriver';
import type { QaTraceRepository } from '../../infrastructure/qa-trace.repository';
import { artifact, input } from './qa-trace.test-fixtures';

describe('GetQaCoverageUseCase', () => {
  it('reads the immutable analysis snapshot without asking for a display graph', async () => {
    const repository = { read: jest.fn().mockResolvedValue(input([artifact('refund')])) };
    const useCase = new GetQaCoverageUseCase(repository as unknown as QaTraceRepository, new QaCoverageDeriver());
    const result = await useCase.execute('analysis');
    expect(repository.read).toHaveBeenCalledWith('analysis');
    expect(result.items[0].artifactId).toBe('refund');
    expect(result.traceContext).toMatchObject({ commitSha: 'commit', analyzerVersion: 'analyzer@0.5.0' });
  });

  it('returns a stable not-found error for an absent analysis', async () => {
    const repository = { read: jest.fn().mockResolvedValue(null) };
    const useCase = new GetQaCoverageUseCase(repository as unknown as QaTraceRepository, new QaCoverageDeriver());
    await expect(useCase.execute('missing')).rejects.toMatchObject({ code: 'IMPACT_ANALYSIS_NOT_FOUND' });
  });
});
