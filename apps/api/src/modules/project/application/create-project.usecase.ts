import type { RequestUser } from '@ba-helper/contracts';
import type { ProjectRepository } from '../infrastructure/project.repository';
import type { EventLogService } from '../../event-log/application/event-log.service';
import { AppError } from '@ba-helper/shared';
import { mapGlobalRoleToProjectRole } from '../domain/project-membership.policy';

export class CreateProjectUseCase {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly eventLog: EventLogService,
  ) {}

  async execute(params: { name: string; actor: RequestUser }) {
    const name = params.name.trim();
    if (!name) {
      throw new AppError('INVALID_PROJECT_NAME', 'Project name is required.');
    }

    const project = await this.repository.createProject(name);
    await this.repository.ensureProjectMember(
      project.id,
      params.actor.id,
      mapGlobalRoleToProjectRole(params.actor.role),
    );
    await this.repository.setSelectedProject(params.actor.id, project.id);
    await this.eventLog.recordEvent({
      eventType: 'PROJECT_CREATED',
      idempotencyKey: `project:${project.id}:created`,
      payload: { projectId: project.id, ownerUserId: params.actor.id },
      actorUserId: params.actor.id,
    });

    return project;
  }
}
