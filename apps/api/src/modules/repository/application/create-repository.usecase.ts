import type { RepositoryRepository } from '../infrastructure/repository.repository';
import type { ProjectRepository } from '../../project/infrastructure/project.repository';
import { RepositoryPolicy } from '../domain/repository.policy';
import { AppError } from '@ba-helper/shared';
import type { EventLogService } from '../../event-log/application/event-log.service';

export class CreateRepositoryUseCase {
  constructor(
    private readonly repository: RepositoryRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly eventLog: EventLogService,
  ) {}

  async execute(params: { projectId: string; url: string }) {
    const project = await this.projectRepository.findById(params.projectId);
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 'Project not found.');
    }

    const normalized = RepositoryPolicy.normalizeUrl(params.url);
    const existing = await this.repository.findByProjectAndUrl({
      projectId: params.projectId,
      canonicalUrl: normalized.canonicalUrl,
    });

    if (existing) {
      return existing;
    }

    const created = await this.repository.createRepository({
      projectId: params.projectId,
      canonicalUrl: normalized.canonicalUrl,
    });

    await this.eventLog.recordEvent({
      eventType: 'REPOSITORY_CREATED',
      idempotencyKey: `repository:${created.id}:created`,
      payload: {
        projectId: created.projectId,
        repositoryId: created.id,
      },
    });

    return created;
  }
}
