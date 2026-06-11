import { Body, Controller, Param, Post, Get } from '@nestjs/common';
import {
  repositoryCreateRequestSchema,
  repositoryCreateResponseSchema,
  repositoryListResponseSchema,
  repositoryDetailResponseSchema,
} from '@ba-helper/contracts';
import { CreateRepositoryUseCase } from '../application/create-repository.usecase';
import { ListRepositoriesUseCase } from '../application/list-repositories.usecase';
import { GetRepositoryUseCase } from '../application/get-repository.usecase';

@Controller('/api/v1/projects/:projectId/repositories')
export class RepositoryController {
  constructor(
    private readonly createRepository: CreateRepositoryUseCase,
    private readonly listRepositories: ListRepositoriesUseCase,
    private readonly getRepository: GetRepositoryUseCase,
  ) {}

  @Post()
  async create(@Param('projectId') projectId: string, @Body() body: unknown) {
    const input = repositoryCreateRequestSchema.parse(body);
    const repository = await this.createRepository.execute({
      projectId,
      url: input.url,
    });

    const response = repositoryCreateResponseSchema.parse({
      repositoryId: repository.id,
      projectId: repository.projectId,
      canonicalUrl: repository.canonicalUrl,
      createdAt: repository.createdAt.toISOString(),
    });

    return response;
  }

  @Get()
  async list(@Param('projectId') projectId: string) {
    const repositories = await this.listRepositories.execute({ projectId });
    return repositoryListResponseSchema.parse({
      items: repositories.map((r) => ({
        id: r.id,
        canonicalUrl: r.canonicalUrl,
        lastObservedAt: r.targets[0]?.lastObservedAt?.toISOString(),
        isConnected: true,
        targets: r.targets.map((t) => ({
          id: t.id,
          targetKey: t.targetKey,
          resolvedRefType: t.resolvedRefType,
          latestObservedCommitSha: t.latestObservedCommitSha,
          lastObservedAt: t.lastObservedAt.toISOString(),
        })),
        createdAt: r.createdAt.toISOString(),
      })),
    });
  }

  @Get('/:repositoryId')
  async getDetail(
    @Param('projectId') projectId: string,
    @Param('repositoryId') repositoryId: string,
  ) {
    const r = await this.getRepository.execute({ repositoryId });
    return repositoryDetailResponseSchema.parse({
      id: r.id,
      canonicalUrl: r.canonicalUrl,
      lastObservedAt: r.targets[0]?.lastObservedAt?.toISOString(),
      isConnected: true,
      targets: r.targets.map((t) => ({
        id: t.id,
        targetKey: t.targetKey,
        resolvedRefType: t.resolvedRefType,
        latestObservedCommitSha: t.latestObservedCommitSha,
        lastObservedAt: t.lastObservedAt.toISOString(),
      })),
      createdAt: r.createdAt.toISOString(),
    });
  }
}
