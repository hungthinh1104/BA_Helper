import type {
  ProjectMemberUpsertRequest,
  RequestUser,
} from '@ba-helper/contracts';
import { AppError } from '@ba-helper/shared';
import type { ProjectPermissionService } from './project-permission.service';
import type { ProjectRepository } from '../infrastructure/project.repository';
import type { EventLogService } from "@ba-helper/backend-runtime";
import type { PasswordHashService } from '../../auth/application/password-hash.service';

export class UpsertProjectMemberUseCase {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly permissions: ProjectPermissionService,
    private readonly eventLog: EventLogService,
    private readonly passwords: PasswordHashService,
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

    let user = await this.repository.findUserByEmail(input.email);
    if (!user) {
      if (!input.initialPassword) {
        throw new AppError(
          'PROJECT_MEMBER_INITIAL_PASSWORD_REQUIRED',
          'Initial password is required when creating a new user.',
        );
      }

      const passwordHash = await this.passwords.hashPassword(input.initialPassword);
      user = await this.repository.createUserWithPassword({
        email: input.email,
        name: input.name,
        passwordHash,
      });
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
