import type { RequestUser } from '@ba-helper/contracts';
import { AppError } from '../../../shared/app-error';
import { EventLogService } from '../../event-log/application/event-log.service';
import { ProjectPermissionService } from './project-permission.service';
import { ProjectRepository } from '../infrastructure/project.repository';

export class RemoveProjectMemberUseCase {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly permissions: ProjectPermissionService,
    private readonly eventLog: EventLogService,
  ) {}

  async execute(actor: RequestUser, projectId: string, userId: string) {
    await this.permissions.assertPermission(
      actor,
      projectId,
      'project:manage',
      'Project member',
    );

    const existing = await this.repository.findProjectMember(projectId, userId);
    if (!existing) {
      throw new AppError('PROJECT_MEMBER_NOT_FOUND', 'Project member not found.');
    }

    if (existing.role === 'OWNER') {
      const ownerCount = await this.repository.countOwners(projectId);
      if (ownerCount <= 1) {
        throw new AppError(
          'LAST_PROJECT_OWNER_REQUIRED',
          'A project must retain at least one OWNER.',
        );
      }
    }

    await this.repository.removeProjectMember(projectId, userId);
    await this.repository.clearSelectedProjectForUserIfMatches(userId, projectId);

    await this.eventLog.recordEvent({
      eventType: 'PROJECT_MEMBER_REMOVED',
      idempotencyKey: `project:${projectId}:member:${userId}:removed`,
      payload: {
        memberUserId: userId,
        projectId,
      },
      actorUserId: actor.id,
    });
  }
}
