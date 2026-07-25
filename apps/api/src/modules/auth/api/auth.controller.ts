import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, Param, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Public } from '../application/jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { getRuntimeConfig } from '../../../bootstrap/runtime-config';
import {
  devLoginRequestSchema,
  loginRequestSchema,
  accountPasswordResetRequestSchema,
  accountProvisionRequestSchema,
  RequestUser,
  type AccountOperationResponse,
  type DevLoginRequest,
  type LoginRequest,
  type LoginResponse,
} from '@ba-helper/contracts';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from "@ba-helper/backend-runtime";
import { PasswordHashService } from '../application/password-hash.service';
import { EventLogService } from '@ba-helper/backend-runtime';
import { Roles } from './roles.decorator';
import * as crypto from 'node:crypto';

@ApiTags('Auth')
@Controller('/api/v1/auth')
export class AuthController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordHashService,
    private readonly eventLog: EventLogService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Returns JWT and user profile' })
  async login(@Body() body: unknown): Promise<LoginResponse> {
    const parsed = loginRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors);
    }
    const input: LoginRequest = parsed.data;

    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user?.passwordHash || user.disabledAt) {
      await this.burnPasswordVerificationCost(input.password);
      await this.recordLoginEvent('AUTH_LOGIN_FAILED', user?.id);
      throw invalidCredentials();
    }

    const passwordMatches = await this.passwords.verifyPassword(
      user.passwordHash,
      input.password,
    );

    if (!passwordMatches) {
      await this.recordLoginEvent('AUTH_LOGIN_FAILED', user.id);
      throw invalidCredentials();
    }

    await this.recordLoginEvent('AUTH_LOGIN_SUCCEEDED', user.id);
    return this.issueLoginResponse({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      credentialsVersion: user.credentialsVersion,
    });
  }

  @Public()
  @Post('dev-login')
  @ApiOperation({ summary: 'Login or create a dev user (MVP only)' })
  @ApiResponse({ status: 200, description: 'Returns JWT and user profile' })
  async devLogin(@Body() body: unknown): Promise<LoginResponse> {
    const config = getRuntimeConfig();
    if (!config.enableDevLogin) {
      throw new ForbiddenException('Dev login is disabled by runtime policy. Set ENABLE_DEV_LOGIN=true and ensure mode allows it.');
    }

    const parsed = devLoginRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors);
    }
    const input: DevLoginRequest = parsed.data;

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

    return this.issueLoginResponse(user);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  async getMe(@CurrentUser() user: RequestUser): Promise<RequestUser> {
    return user;
  }

  @Post('accounts')
  @Roles('ADMIN')
  async provisionAccount(
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ): Promise<AccountOperationResponse> {
    const input = accountProvisionRequestSchema.parse(body);
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new ConflictException('Account already exists.');
    }
    const passwordHash = await this.passwords.hashPassword(input.password);
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        role: input.role,
      },
    });
    await this.recordAccountEvent('ACCOUNT_PROVISIONED', actor.id, user.id);
    return { userId: user.id, status: 'ACTIVE' };
  }

  @Post('accounts/:userId/reset-password')
  @Roles('ADMIN')
  async resetPassword(
    @Param('userId') userId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ): Promise<AccountOperationResponse> {
    const input = accountPasswordResetRequestSchema.parse(body);
    const passwordHash = await this.passwords.hashPassword(input.password);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        credentialsVersion: { increment: 1 },
      },
    });
    await this.recordAccountEvent('ACCOUNT_PASSWORD_RESET', actor.id, user.id);
    return { userId: user.id, status: 'PASSWORD_RESET' };
  }

  @Post('accounts/:userId/disable')
  @Roles('ADMIN')
  async disableAccount(
    @Param('userId') userId: string,
    @CurrentUser() actor: RequestUser,
  ): Promise<AccountOperationResponse> {
    if (actor.id === userId) {
      throw new BadRequestException('Administrators cannot disable their own account.');
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        disabledAt: new Date(),
        credentialsVersion: { increment: 1 },
      },
    });
    await this.recordAccountEvent('ACCOUNT_DISABLED', actor.id, user.id);
    return { userId: user.id, status: 'DISABLED' };
  }

  private issueLoginResponse(user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    credentialsVersion?: number;
  }): LoginResponse {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      credentialsVersion: user.credentialsVersion ?? 1,
    };
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

  private async burnPasswordVerificationCost(password: string): Promise<void> {
    await this.passwords.hashPassword(password);
  }

  private async recordLoginEvent(
    eventType: 'AUTH_LOGIN_SUCCEEDED' | 'AUTH_LOGIN_FAILED',
    userId?: string,
  ): Promise<void> {
    await this.eventLog.recordEvent({
      eventType,
      idempotencyKey: `auth:login:${crypto.randomUUID()}`,
      payload: {
        outcome: eventType === 'AUTH_LOGIN_SUCCEEDED' ? 'SUCCESS' : 'FAILURE',
        ...(userId ? { subjectUserId: userId } : {}),
      },
      ...(userId ? { actorUserId: userId } : {}),
    });
  }

  private async recordAccountEvent(
    eventType:
      | 'ACCOUNT_PROVISIONED'
      | 'ACCOUNT_PASSWORD_RESET'
      | 'ACCOUNT_DISABLED',
    actorUserId: string,
    subjectUserId: string,
  ): Promise<void> {
    await this.eventLog.recordEvent({
      eventType,
      idempotencyKey: `${eventType.toLowerCase()}:${subjectUserId}:${crypto.randomUUID()}`,
      payload: { subjectUserId },
      actorUserId,
    });
  }
}

function invalidCredentials(): UnauthorizedException {
  return new UnauthorizedException('Invalid email or password.');
}
