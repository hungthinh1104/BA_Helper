import { CreateRequirementRevisionUseCase } from './create-revision.usecase';
import { RequirementRepository } from '../infrastructure/requirement.repository';
import { AppError } from '@ba-helper/shared';

describe('CreateRequirementRevisionUseCase', () => {
  let useCase: CreateRequirementRevisionUseCase;
  let repository: jest.Mocked<RequirementRepository>;

  beforeEach(() => {
    repository = {
      findRequirementById: jest.fn(),
      createRequirement: jest.fn(),
      createRevisionWithReadinessTransition: jest.fn(),
      qualifyRevisionWithReadinessTransition: jest.fn(),
      findRevisionById: jest.fn(),
    } as unknown as jest.Mocked<RequirementRepository>;

    useCase = new CreateRequirementRevisionUseCase(repository);
  });

  it('throws an error if requirement is not found', async () => {
    repository.findRequirementById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        requirementId: 'req-1',
        title: 'Title',
        rawText: 'cancel booking',
        submitForReadinessCheck: true,
      }),
    ).rejects.toThrow(AppError);
  });

  it('throws an error if input contains potential secrets', async () => {
    repository.findRequirementById.mockResolvedValue({ id: 'req-1' } as any);

    await expect(
      useCase.execute({
        requirementId: 'req-1',
        title: 'Title',
        rawText: 'cancel booking AKIAIOSFODNN7EXAMPLE',
        submitForReadinessCheck: true,
      }),
    ).rejects.toThrow(AppError);
  });

  it('creates a READY_FOR_ANALYSIS revision when input is actionable and readiness check is requested', async () => {
    repository.findRequirementById.mockResolvedValue({ id: 'req-1' } as any);
    repository.createRevisionWithReadinessTransition.mockResolvedValue({
      id: 'rev-1',
      requirementId: 'req-1',
      title: 'Title',
      rawText: 'cancel paid booking and refund',
      normalizedText: 'cancel paid booking and refund',
      readinessStatus: 'READY_FOR_ANALYSIS',
      validationIssues: [],
      createdAt: new Date(),
    } as any);

    const result = await useCase.execute({
      requirementId: 'req-1',
      title: 'Title',
      rawText: 'cancel paid booking and refund',
      submitForReadinessCheck: true,
    });

    expect(result.readiness.status).toBe('READY_FOR_ANALYSIS');
    expect(repository.createRevisionWithReadinessTransition).toHaveBeenCalledWith({
      requirementId: 'req-1',
      title: 'Title',
      rawText: 'cancel paid booking and refund',
      normalizedText: 'cancel paid booking and refund',
      readinessStatus: 'READY_FOR_ANALYSIS',
      validationIssues: [],
    });
  });

  it('creates a DRAFT revision when readiness check is not requested', async () => {
    repository.findRequirementById.mockResolvedValue({ id: 'req-1' } as any);
    repository.createRevisionWithReadinessTransition.mockResolvedValue({
      id: 'rev-1',
      readinessStatus: 'DRAFT',
    } as any);

    const result = await useCase.execute({
      requirementId: 'req-1',
      title: 'Title',
      rawText: 'cancel paid booking and refund',
      submitForReadinessCheck: false,
    });

    expect(result.readiness.status).toBe('DRAFT');
    expect(repository.createRevisionWithReadinessTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        readinessStatus: 'DRAFT',
      }),
    );
  });
});
