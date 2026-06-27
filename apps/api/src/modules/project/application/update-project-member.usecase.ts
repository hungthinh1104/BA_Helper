import type {
  ProjectMemberUpdateRequest,
  RequestUser,
} from '@ba-helper/contracts';
import { AppError } from '@ba-helper/shared';
import type { EventLogService } from '../../event-log/application/event-log.service';
import type { ProjectPermissionService } from './project-permission.service';
import type { ProjectRepository } from '../infrastructure/project.repository';

export class UpdateProjectMemberUseCase {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly permissions: ProjectPermissionService,
    private readonly eventLog: EventLogService,
  ) {}

  async execute(
    actor: RequestUser,
    projectId: string,
    userId: string,
    input: ProjectMemberUpdateRequest,
  ) {
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

    if (existing.role === 'OWNER' && input.role !== 'OWNER') {
      const ownerCount = await this.repository.countOwners(projectId);
      if (ownerCount <= 1) {
        throw new AppError(
          'LAST_PROJECT_OWNER_REQUIRED',
          'A project must retain at least one OWNER.',
        );
      }
    }

    const member = await this.repository.updateProjectMemberRole(
      projectId,
      userId,
      input.role,
    );

    await this.eventLog.recordEvent({
      eventType: 'PROJECT_MEMBER_UPDATED',
      idempotencyKey: `project:${projectId}:member:${userId}:role:${input.role}`,
      payload: {
        memberRole: input.role,
        memberUserId: userId,
        projectId,
      },
      actorUserId: actor.id,
    });

    return member;
  }
}
