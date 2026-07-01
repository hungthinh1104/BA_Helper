import type {
  ProjectMemberUpsertRequest,
  RequestUser,
} from '@ba-helper/contracts';
import { AppError } from '@ba-helper/shared';
import type { ProjectPermissionService } from './project-permission.service';
import type { ProjectRepository } from '../infrastructure/project.repository';
import { EventLogService } from "@ba-helper/backend-runtime";

export class UpsertProjectMemberUseCase {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly permissions: ProjectPermissionService,
    private readonly eventLog: EventLogService,
  ) {}

  async execute(
    actor: RequestUser,
    projectId: string,
    input: ProjectMemberUpsertRequest,
  ) {
    await this.permissions.assertPermission(
      actor,
      projectId,
      'project:manage',
      'Project member',
    );

    const user = await this.repository.findUserByEmail(input.email);
    if (!user) {
      throw new AppError(
        'PROJECT_MEMBER_USER_NOT_FOUND',
        'User for project membership was not found.',
      );
    }

    const member = await this.repository.ensureProjectMember(
      projectId,
      user.id,
      input.role,
    );

    await this.eventLog.recordEvent({
      eventType: 'PROJECT_MEMBER_UPSERTED',
      idempotencyKey: `project:${projectId}:member:${user.id}:upsert:${input.role}`,
      payload: {
        memberRole: input.role,
        memberUserId: user.id,
        projectId,
      },
      actorUserId: actor.id,
    });

    return member;
  }
}
