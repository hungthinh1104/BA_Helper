import type { ProjectRepository } from '../infrastructure/project.repository';

export class ListProjectMembersUseCase {
  constructor(private readonly repository: ProjectRepository) {}

  async execute(projectId: string) {
    return this.repository.listProjectMembers(projectId);
  }
}
