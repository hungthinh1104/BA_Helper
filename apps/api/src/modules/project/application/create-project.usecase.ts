import { ProjectRepository } from '../infrastructure/project.repository';
import { EventLogService } from '../../event-log/application/event-log.service';
import { AppError } from '../../../shared/app-error';

export class CreateProjectUseCase {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly eventLog: EventLogService,
  ) {}

  async execute(params: { name: string }) {
    const name = params.name.trim();
    if (!name) {
      throw new AppError('INVALID_PROJECT_NAME', 'Project name is required.');
    }

    const project = await this.repository.createProject(name);
    await this.eventLog.recordEvent({
      eventType: 'PROJECT_CREATED',
      idempotencyKey: `project:${project.id}:created`,
      payload: { projectId: project.id },
    });

    return project;
  }
}
