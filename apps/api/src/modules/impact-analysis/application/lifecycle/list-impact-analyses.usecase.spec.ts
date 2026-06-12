import { ListImpactAnalysesUseCase } from './list-impact-analyses.usecase';
import { ImpactAnalysisRepository } from '../../infrastructure/impact-analysis.repository';
import { ProjectRepository } from '../../../project/infrastructure/project.repository';

describe('ListImpactAnalysesUseCase', () => {
  let useCase: ListImpactAnalysesUseCase;
  let impactAnalysisRepo: jest.Mocked<ImpactAnalysisRepository>;
  let projectRepo: jest.Mocked<ProjectRepository>;

  beforeEach(() => {
    impactAnalysisRepo = {
      findByProject: jest.fn(),
    } as unknown as jest.Mocked<ImpactAnalysisRepository>;

    projectRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<ProjectRepository>;

    useCase = new ListImpactAnalysesUseCase(impactAnalysisRepo, projectRepo);
  });

  it('returns project analyses ordered by repository query', async () => {
    const analyses = [{ id: 'analysis-2' }, { id: 'analysis-1' }] as any[];
    projectRepo.findById.mockResolvedValue({ id: 'project-1' } as any);
    impactAnalysisRepo.findByProject.mockResolvedValue(analyses as any);

    const result = await useCase.execute({ projectId: 'project-1' });

    expect(projectRepo.findById).toHaveBeenCalledWith('project-1');
    expect(impactAnalysisRepo.findByProject).toHaveBeenCalledWith('project-1', undefined, undefined);
    expect(result).toBe(analyses);
  });

  it('throws PROJECT_NOT_FOUND for unknown project', async () => {
    projectRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ projectId: 'missing-project' }),
    ).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });

    expect(impactAnalysisRepo.findByProject).not.toHaveBeenCalled();
  });
});
