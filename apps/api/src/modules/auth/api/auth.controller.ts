import { Controller, Post, Get, Body, UnauthorizedException, HttpException, HttpStatus, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../application/jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { RequestUser, LoginRequest, LoginResponse } from '@ba-helper/contracts';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

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
  async devLogin(@Body() body: LoginRequest): Promise<LoginResponse> {
    if (process.env.ENABLE_DEV_LOGIN !== 'true') {
      throw new ForbiddenException('Dev login is disabled');
    }

    if (!body.email) {
      throw new HttpException('Email is required', HttpStatus.BAD_REQUEST);
    }

    let user = await this.prisma.user.findUnique({
      where: { email: body.email },
    });

    if (!user) {
      const role = body.role || 'ADMIN';
      // Auto-create dev user if not exists for convenience during Phase 13A
      user = await this.prisma.user.create({
        data: {
          email: body.email,
          name: body.email.split('@')[0],
          role: role,
        },
      });
    } else if (body.role && user.role !== body.role) {
      user = await this.prisma.user.update({
        where: { email: body.email },
        data: { role: body.role },
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
