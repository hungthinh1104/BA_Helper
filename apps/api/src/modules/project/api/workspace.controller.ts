import {
  Controller,
  Get,
  Headers,
  Post,
  Body,
  UnauthorizedException,
} from '@nestjs/common';
import {
  currentWorkspaceResponseSchema,
  selectProjectRequestSchema,
  type RequestUser,
} from '@ba-helper/contracts';
import { Public } from '../../auth/application/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { GetCurrentWorkspaceUseCase } from '../application/get-current-workspace.usecase';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { SelectProjectUseCase } from '../application/select-project.usecase';

@Controller('/api/v1/workspace')
export class WorkspaceController {
  constructor(
    private readonly getCurrentWorkspace: GetCurrentWorkspaceUseCase,
    private readonly selectProject: SelectProjectUseCase,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('/current')
  async getCurrent(@Headers('authorization') authorization?: string) {
    const actor = await this.resolveOptionalActor(authorization);
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
    const input = selectProjectRequestSchema.parse(body);
    const result = await this.selectProject.execute(actor, input.projectId);

    return currentWorkspaceResponseSchema.parse({
      projectId: result.project.id,
      name: result.project.name,
      mode: result.mode,
      membershipRole: result.membershipRole,
      createdAt: result.project.createdAt.toISOString(),
    });
  }

  private async resolveOptionalActor(
    authorization?: string,
  ): Promise<RequestUser | undefined> {
    if (!authorization) {
      return undefined;
    }

    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header.');
    }

    let payload: { sub: string; email: string; role: string; name?: string };
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Invalid access token.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as RequestUser['role'],
    };
  }
}
