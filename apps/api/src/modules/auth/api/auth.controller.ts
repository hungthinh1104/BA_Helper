import { BadRequestException, Body, Controller, ForbiddenException, Get, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Public } from '../application/jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { getRuntimeConfig } from '../../../bootstrap/runtime-config';
import { loginRequestSchema, RequestUser, type LoginRequest, type LoginResponse } from '@ba-helper/contracts';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from "@ba-helper/backend-runtime";

@ApiTags('Auth')
@Controller('/api/v1/auth')
export class AuthController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('dev-login')
  @ApiOperation({ summary: 'Login or create a dev user (MVP only)' })
  @ApiResponse({ status: 200, description: 'Returns JWT and user profile' })
  async devLogin(@Body() body: unknown): Promise<LoginResponse> {
    const config = getRuntimeConfig();
    if (!config.enableDevLogin) {
      throw new ForbiddenException('Dev login is disabled by runtime policy. Set ENABLE_DEV_LOGIN=true and ensure mode allows it.');
    }

    const parsed = loginRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors);
    }
    const input: LoginRequest = parsed.data;

    let user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      const role = input.role || 'ADMIN';
      // Auto-create dev user if not exists for convenience during Phase 13A
      user = await this.prisma.user.create({
        data: {
          email: input.email,
          name: input.email.split('@')[0],
          role: role,
        },
      });
    } else if (input.role && user.role !== input.role) {
      user = await this.prisma.user.update({
        where: { email: input.email },
        data: { role: input.role },
      });
    }

    const payload = { sub: user.id, email: user.email, role: user.role, name: user.name };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as any,
      },
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  async getMe(@CurrentUser() user: RequestUser): Promise<RequestUser> {
    return user;
  }
}
