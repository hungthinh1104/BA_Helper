import type { RequestUser } from '@ba-helper/contracts';
import { mapGlobalRoleToProjectRole } from '../domain/project-membership.policy';
import type { ProjectRepository } from '../infrastructure/project.repository';
import type {
  CurrentWorkspaceResolver,
  ResolvedWorkspace,
} from './current-workspace.resolver';
import { EventLogService } from "@ba-helper/backend-runtime";

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
    if (!actor) {
      const project = await this.ensureDefaultProject();
      return {
        project,
        membershipRole: null,
        mode: this.mode,
      };
    }

    const selected = await this.resolveSelectedProject(actor);
    if (selected) {
      return {
        project: selected.project,
        membershipRole: selected.membershipRole,
        mode: this.mode,
      };
    }

    const defaultProject = await this.ensureDefaultProject();
    const membershipRole = await this.ensureMembership(defaultProject.id, actor);
    await this.repository.setSelectedProject(actor.id, defaultProject.id);

    return {
      project: defaultProject,
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

  private async ensureDefaultProject() {
    const existing = await this.repository.findByName(DEFAULT_PROJECT_NAME);
    if (existing) {
      return existing;
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

    return project;
  }

  private async resolveSelectedProject(actor: RequestUser) {
    const selected = await this.repository.findSelectedProjectForUser(actor.id);
    if (selected?.selectedProjectId && selected.selectedProject) {
      const membership = await this.repository.findProjectMember(
        selected.selectedProjectId,
        actor.id,
      );
      if (membership) {
        return {
          project: selected.selectedProject,
          membershipRole: membership.role,
        };
      }
    }

    const memberships = await this.repository.listProjectsForUser(actor.id);
    const fallback = memberships[0];
    if (!fallback) {
      return null;
    }

    await this.repository.setSelectedProject(actor.id, fallback.projectId);
    return {
      project: fallback.project,
      membershipRole: fallback.role,
    };
  }
}
