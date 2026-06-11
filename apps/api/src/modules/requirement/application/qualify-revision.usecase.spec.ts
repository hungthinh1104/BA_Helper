import { QualifyRequirementRevisionUseCase } from './qualify-revision.usecase';
import { RequirementRepository } from '../infrastructure/requirement.repository';
import { AppError } from '../../../shared/app-error';

describe('QualifyRequirementRevisionUseCase', () => {
  let useCase: QualifyRequirementRevisionUseCase;
  let repository: jest.Mocked<RequirementRepository>;

  beforeEach(() => {
    repository = {
      findRequirementById: jest.fn(),
      createRequirement: jest.fn(),
      createRevisionWithReadinessTransition: jest.fn(),
      qualifyRevisionWithReadinessTransition: jest.fn(),
      findRevisionById: jest.fn(),
    } as unknown as jest.Mocked<RequirementRepository>;

    useCase = new QualifyRequirementRevisionUseCase(repository);
  });

  it('throws an error if revision is not found', async () => {
    repository.findRevisionById.mockResolvedValue(null);

    await expect(useCase.execute({ revisionId: 'rev-1' })).rejects.toThrow(
      AppError,
    );
  });

  it('qualifies a valid revision to READY_FOR_ANALYSIS and calls transition method', async () => {
    repository.findRevisionById.mockResolvedValue({
      id: 'rev-1',
      requirementId: 'req-1',
      rawText: 'cancel paid booking and refund',
    } as any);

    repository.qualifyRevisionWithReadinessTransition.mockResolvedValue({
      id: 'rev-1',
      readinessStatus: 'READY_FOR_ANALYSIS',
    } as any);

    const result = await useCase.execute({ revisionId: 'rev-1' });

    expect(result.readiness.status).toBe('READY_FOR_ANALYSIS');
    expect(
      repository.qualifyRevisionWithReadinessTransition,
    ).toHaveBeenCalledWith({
      revisionId: 'rev-1',
      requirementId: 'req-1',
      readinessStatus: 'READY_FOR_ANALYSIS',
      validationIssues: [],
    });
  });

  it('qualifies a vague revision to NEEDS_CLARIFICATION', async () => {
    repository.findRevisionById.mockResolvedValue({
      id: 'rev-1',
      requirementId: 'req-1',
      rawText: 'short',
    } as any);

    repository.qualifyRevisionWithReadinessTransition.mockResolvedValue({
      id: 'rev-1',
      readinessStatus: 'NEEDS_CLARIFICATION',
    } as any);

    const result = await useCase.execute({ revisionId: 'rev-1' });

    expect(result.readiness.status).toBe('NEEDS_CLARIFICATION');
    expect(
      repository.qualifyRevisionWithReadinessTransition,
    ).toHaveBeenCalledWith({
      revisionId: 'rev-1',
      requirementId: 'req-1',
      readinessStatus: 'NEEDS_CLARIFICATION',
      validationIssues: expect.any(Array),
    });
  });
});
