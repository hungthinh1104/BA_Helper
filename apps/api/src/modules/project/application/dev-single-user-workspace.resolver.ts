import type { RequestUser } from '@ba-helper/contracts';
import { EventLogService } from '../../event-log/application/event-log.service';
import { mapGlobalRoleToProjectRole } from '../domain/project-membership.policy';
import { ProjectRepository } from '../infrastructure/project.repository';
import {
  CurrentWorkspaceResolver,
  ResolvedWorkspace,
} from './current-workspace.resolver';

const DEFAULT_PROJECT_NAME = 'Default Project';

export class DevSingleUserWorkspaceResolver
  implements CurrentWorkspaceResolver
{
  readonly mode = 'dev-single-user' as const;

  constructor(
    private readonly repository: ProjectRepository,
    private readonly eventLog: EventLogService,
  ) {}

  async resolveCurrentWorkspace(actor?: RequestUser): Promise<ResolvedWorkspace> {
    const existing = await this.repository.findByName(DEFAULT_PROJECT_NAME);
    if (existing) {
      const membershipRole = await this.ensureMembership(existing.id, actor);
      return {
        project: existing,
        membershipRole,
        mode: this.mode,
      };
    }

    const project = await this.repository.createProject(DEFAULT_PROJECT_NAME);
    await this.eventLog.recordEvent({
      eventType: 'WORKSPACE_DEFAULT_PROJECT_CREATED',
      idempotencyKey: `workspace:${project.id}:default-created`,
      payload: {
        projectId: project.id,
        workspaceMode: this.mode,
      },
    });

    const membershipRole = await this.ensureMembership(project.id, actor);

    return {
      project,
      membershipRole,
      mode: this.mode,
    };
  }

  private async ensureMembership(
    projectId: string,
    actor?: RequestUser,
  ): Promise<ResolvedWorkspace['membershipRole']> {
    if (!actor) {
      return null;
    }

    const projectRole = mapGlobalRoleToProjectRole(actor.role);
    const member = await this.repository.ensureProjectMember(
      projectId,
      actor.id,
      projectRole,
    );

    return member.role;
  }
}
