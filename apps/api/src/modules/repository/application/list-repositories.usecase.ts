import { RepositoryRepository } from '../infrastructure/repository.repository';
import { ProjectRepository } from '../../project/infrastructure/project.repository';
import { AppError } from '../../../shared/app-error';

export class ListRepositoriesUseCase {
  constructor(
    private readonly repositoryRepo: RepositoryRepository,
    private readonly projectRepo: ProjectRepository,
  ) {}

  async execute(params: { projectId: string }) {
    const project = await this.projectRepo.findById(params.projectId);
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 'Project not found.');
    }

    return this.repositoryRepo.findByProject(params.projectId);
  }
}
