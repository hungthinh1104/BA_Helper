import type { RequestUser } from '@ba-helper/contracts';
import { ProjectRepository } from '../infrastructure/project.repository';

export class ListProjectsUseCase {
  constructor(private readonly repository: ProjectRepository) {}

  async execute(actor: RequestUser) {
    const selected = await this.repository.findSelectedProjectForUser(actor.id);
    const memberships = await this.repository.listProjectsForUser(actor.id);

    return memberships.map((membership) => ({
      createdAt: membership.project.createdAt,
      isSelected: membership.projectId === selected?.selectedProjectId,
      membershipRole: membership.role,
      name: membership.project.name,
      projectId: membership.projectId,
    }));
  }
}
