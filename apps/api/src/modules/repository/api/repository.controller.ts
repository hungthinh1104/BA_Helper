import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  repositoryCreateRequestSchema,
  repositoryCreateResponseSchema,
} from '@ba-helper/contracts';
import { CreateRepositoryUseCase } from '../application/create-repository.usecase';

@Controller('/api/v1/projects/:projectId/repositories')
export class RepositoryController {
  constructor(private readonly createRepository: CreateRepositoryUseCase) {}

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
}
