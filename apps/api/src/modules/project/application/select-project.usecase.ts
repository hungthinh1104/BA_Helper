import type { RequestUser } from '@ba-helper/contracts';
import { AppError } from '@ba-helper/shared';
import type { GetCurrentWorkspaceUseCase } from './get-current-workspace.usecase';
import type { ProjectRepository } from '../infrastructure/project.repository';
import { EventLogService } from "@ba-helper/backend-runtime";

export class SelectProjectUseCase {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly eventLog: EventLogService,
    private readonly getCurrentWorkspace: GetCurrentWorkspaceUseCase,
  ) {}

  async execute(actor: RequestUser, projectId: string) {
    const membership = await this.repository.findProjectMember(projectId, actor.id);
    if (!membership) {
      throw new AppError('PROJECT_NOT_FOUND', 'Project not found.');
    }

    await this.repository.setSelectedProject(actor.id, projectId);
    await this.eventLog.recordEvent({
      eventType: 'PROJECT_SELECTED',
      idempotencyKey: `user:${actor.id}:selected-project:${projectId}`,
      payload: {
        projectId,
      },
      actorUserId: actor.id,
    });
    return this.getCurrentWorkspace.execute(actor);
  }
}
