import { Controller, Get } from '@nestjs/common';
import { currentWorkspaceResponseSchema } from '@ba-helper/contracts';
import { Public } from '../../auth/application/jwt-auth.guard';
import { GetCurrentWorkspaceUseCase } from '../application/get-current-workspace.usecase';

@Controller('/api/v1/workspace')
export class WorkspaceController {
  constructor(
    private readonly getCurrentWorkspace: GetCurrentWorkspaceUseCase,
  ) {}

  @Public()
  @Get('/current')
  async getCurrent() {
    const result = await this.getCurrentWorkspace.execute();

    return currentWorkspaceResponseSchema.parse({
      projectId: result.project.id,
      name: result.project.name,
      mode: result.mode,
      createdAt: result.project.createdAt.toISOString(),
    });
  }
}
