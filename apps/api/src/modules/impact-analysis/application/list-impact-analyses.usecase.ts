import { ImpactAnalysisRepository } from '../infrastructure/impact-analysis.repository';
import { ProjectRepository } from '../../project/infrastructure/project.repository';
import { AppError } from '../../../shared/app-error';

export class ListImpactAnalysesUseCase {
  constructor(
    private readonly impactAnalysisRepo: ImpactAnalysisRepository,
    private readonly projectRepo: ProjectRepository,
  ) {}

  async execute(params: { projectId: string; limit?: number; offset?: number }) {
    const project = await this.projectRepo.findById(params.projectId);
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 'Project not found.');
    }

    return this.impactAnalysisRepo.findByProject(params.projectId, params.limit, params.offset);
  }
}
