import { parseApiInput } from '../../../shared/parse-api-input';
import {
  Controller,
  Get,
  Post,
  Body,
} from '@nestjs/common';
import {
  currentWorkspaceResponseSchema,
  selectProjectRequestSchema,
  type RequestUser,
} from '@ba-helper/contracts';
import { OptionalAuth } from '../../auth/application/jwt-auth.guard';
import { GetCurrentWorkspaceUseCase } from '../application/get-current-workspace.usecase';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { SelectProjectUseCase } from '../application/select-project.usecase';

@Controller('/api/v1/workspace')
export class WorkspaceController {
  constructor(
    private readonly getCurrentWorkspace: GetCurrentWorkspaceUseCase,
    private readonly selectProject: SelectProjectUseCase,
  ) {}

  @OptionalAuth()
  @Get('/current')
  async getCurrent(@CurrentUser() actor?: RequestUser) {
    const result = await this.getCurrentWorkspace.execute(actor);

    return currentWorkspaceResponseSchema.parse({
      projectId: result.project.id,
      name: result.project.name,
      mode: result.mode,
      membershipRole: result.membershipRole,
      createdAt: result.project.createdAt.toISOString(),
    });
  }

  @Post('/select-project')
  async select(
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    const input = parseApiInput(selectProjectRequestSchema, body);
    const result = await this.selectProject.execute(actor, input.projectId);

    return currentWorkspaceResponseSchema.parse({
      projectId: result.project.id,
      name: result.project.name,
      mode: result.mode,
      membershipRole: result.membershipRole,
      createdAt: result.project.createdAt.toISOString(),
    });
  }
}
