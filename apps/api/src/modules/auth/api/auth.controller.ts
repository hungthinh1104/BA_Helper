import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Param, Post, Query, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Public } from '../application/jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { getRuntimeConfig } from '../../../bootstrap/runtime-config';
import {
  devLoginRequestSchema,
  loginRequestSchema,
  accountPasswordResetRequestSchema,
  accountProvisionRequestSchema,
  accountRoleUpdateRequestSchema,
  changeOwnPasswordRequestSchema,
  RequestUser,
  type AccountAuditListResponse,
  type AccountListResponse,
  type AccountOperationResponse,
  type AccountSummary,
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

  @Post('me/change-password')
  @ApiOperation({ summary: 'Change the current user password' })
  async changeOwnPassword(
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ): Promise<AccountOperationResponse> {
    const input = changeOwnPasswordRequestSchema.parse(body);
    const user = await this.prisma.user.findUnique({ where: { id: actor.id } });
    // A verifiable current password is required; local accounts without a hash
    // must go through an admin reset instead of self-service change.
    if (!user?.passwordHash || user.disabledAt) {
      await this.burnPasswordVerificationCost(input.currentPassword);
      throw invalidCredentials();
    }
    const matches = await this.passwords.verifyPassword(
      user.passwordHash,
      input.currentPassword,
    );
    if (!matches) {
      throw invalidCredentials();
    }
    const passwordHash = await this.passwords.hashPassword(input.newPassword);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      // Bumping credentialsVersion revokes every other active session.
      data: { passwordHash, credentialsVersion: { increment: 1 } },
    });
    await this.recordAccountEvent('ACCOUNT_PASSWORD_CHANGED', actor.id, updated.id);
    return { userId: updated.id, status: 'PASSWORD_CHANGED' };
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

  @Post('accounts/:userId/enable')
  @Roles('ADMIN')
  async enableAccount(
    @Param('userId') userId: string,
    @CurrentUser() actor: RequestUser,
  ): Promise<AccountOperationResponse> {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new NotFoundException('Account not found.');
    }
    // Re-enabling only clears the disabled flag; it does not revoke sessions
    // (a disabled account already had none), so credentialsVersion is untouched.
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { disabledAt: null },
    });
    await this.recordAccountEvent('ACCOUNT_ENABLED', actor.id, user.id);
    return { userId: user.id, status: 'ENABLED' };
  }

  @Post('accounts/:userId/role')
  @Roles('ADMIN')
  async updateAccountRole(
    @Param('userId') userId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ): Promise<AccountOperationResponse> {
    const input = accountRoleUpdateRequestSchema.parse(body);
    if (actor.id === userId) {
      // Prevent an admin from demoting themselves into a lockout.
      throw new BadRequestException('Administrators cannot change their own role.');
    }
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new NotFoundException('Account not found.');
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      // Bumping credentialsVersion forces re-auth so tokens carrying the old role
      // stop working immediately.
      data: { role: input.role, credentialsVersion: { increment: 1 } },
    });
    await this.recordAccountEvent('ACCOUNT_ROLE_UPDATED', actor.id, user.id);
    return { userId: user.id, status: 'ROLE_UPDATED' };
  }

  @Get('accounts')
  @Roles('ADMIN')
  async listAccounts(): Promise<AccountListResponse> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return { items: users.map((user) => this.toAccountSummary(user)) };
  }

  @Get('accounts/audit')
  @Roles('ADMIN')
  async listAccountAudit(
    @Query('limit') limit?: string,
  ): Promise<AccountAuditListResponse> {
    const take = Math.min(Math.max(Number.parseInt(limit ?? '', 10) || 100, 1), 500);
    const events = await this.prisma.domainEvent.findMany({
      where: { eventType: { in: [...ACCOUNT_AUDIT_EVENT_TYPES] } },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return {
      items: events.map((event) => {
        const payload = (event.payload ?? {}) as {
          actorUserId?: string;
          subjectUserId?: string;
        };
        return {
          id: event.id,
          eventType: event.eventType,
          actorUserId: payload.actorUserId ?? null,
          subjectUserId: payload.subjectUserId ?? null,
          createdAt: event.createdAt.toISOString(),
        };
      }),
    };
  }

  @Get('accounts/:userId')
  @Roles('ADMIN')
  async getAccount(
    @Param('userId') userId: string,
  ): Promise<AccountSummary> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Account not found.');
    }
    return this.toAccountSummary(user);
  }

  private toAccountSummary(user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    disabledAt: Date | null;
    createdAt: Date;
  }): AccountSummary {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as AccountSummary['role'],
      status: user.disabledAt ? 'DISABLED' : 'ACTIVE',
      createdAt: user.createdAt.toISOString(),
    };
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
    eventType: (typeof ACCOUNT_AUDIT_EVENT_TYPES)[number],
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

const ACCOUNT_AUDIT_EVENT_TYPES = [
  'ACCOUNT_PROVISIONED',
  'ACCOUNT_PASSWORD_RESET',
  'ACCOUNT_PASSWORD_CHANGED',
  'ACCOUNT_DISABLED',
  'ACCOUNT_ENABLED',
  'ACCOUNT_ROLE_UPDATED',
] as const;

function invalidCredentials(): UnauthorizedException {
  return new UnauthorizedException('Invalid email or password.');
}
