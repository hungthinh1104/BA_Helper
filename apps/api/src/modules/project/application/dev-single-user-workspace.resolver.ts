import { EventLogService } from '../../event-log/application/event-log.service';
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

  async resolveCurrentWorkspace(): Promise<ResolvedWorkspace> {
    const existing = await this.repository.findByName(DEFAULT_PROJECT_NAME);
    if (existing) {
      return {
        project: existing,
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

    return {
      project,
      mode: this.mode,
    };
  }
}

