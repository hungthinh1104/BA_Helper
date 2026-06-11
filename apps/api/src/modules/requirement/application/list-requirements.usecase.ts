import { RequirementRepository } from '../infrastructure/requirement.repository';
import { ProjectRepository } from '../../project/infrastructure/project.repository';
import { AppError } from '../../../shared/app-error';

export class ListRequirementsUseCase {
  constructor(
    private readonly requirementRepo: RequirementRepository,
    private readonly projectRepo: ProjectRepository,
  ) {}

  async execute(params: { projectId: string }) {
    const project = await this.projectRepo.findById(params.projectId);
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 'Project not found.');
    }

    return this.requirementRepo.findByProject(params.projectId);
  }
}
