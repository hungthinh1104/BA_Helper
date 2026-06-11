import { Body, Controller, Post } from '@nestjs/common';
import {
  projectCreateRequestSchema,
  projectCreateResponseSchema,
} from '@ba-helper/contracts';
import { Roles } from '../../auth/api/roles.decorator';
import { CreateProjectUseCase } from '../application/create-project.usecase';

@Controller('/api/v1/projects')
export class ProjectController {
  constructor(private readonly createProject: CreateProjectUseCase) {}

  @Post()
  @Roles('ADMIN')
  async create(@Body() body: unknown) {
    const input = projectCreateRequestSchema.parse(body);
    const project = await this.createProject.execute({ name: input.name });

    const response = projectCreateResponseSchema.parse({
      projectId: project.id,
      name: project.name,
      createdAt: project.createdAt.toISOString(),
    });

    return response;
  }
}
