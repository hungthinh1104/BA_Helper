import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from "@ba-helper/backend-runtime";
import { PasswordHashService } from '../application/password-hash.service';
import { EventLogService } from '@ba-helper/backend-runtime';

describe('AuthController', () => {
  let controller: AuthController;
  let jwtService: JwtService;
  let prismaService: PrismaService;
  let passwordHashService: PasswordHashService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('mocked-token') },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: PasswordHashService,
          useValue: {
            hashPassword: jest.fn().mockResolvedValue('scrypt$mock'),
            verifyPassword: jest.fn(),
          },
        },
        {
          provide: EventLogService,
          useValue: {
            recordEvent: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jwtService = module.get<JwtService>(JwtService);
    prismaService = module.get<PrismaService>(PrismaService);
    passwordHashService = module.get<PasswordHashService>(PasswordHashService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should issue token with valid email and password', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        name: 'test',
        role: 'REVIEWER',
        passwordHash: 'scrypt$stored',
      });
      (passwordHashService.verifyPassword as jest.Mock).mockResolvedValue(true);

      const result = await controller.login({
        email: 'test@example.com',
        password: 'correct-password',
      });

      expect(passwordHashService.verifyPassword).toHaveBeenCalledWith(
        'scrypt$stored',
        'correct-password',
      );
      expect(prismaService.user.update).not.toHaveBeenCalled();
      expect(result.accessToken).toBe('mocked-token');
      expect(result.user).toEqual({
        id: 'user-id',
        email: 'test@example.com',
        name: 'test',
        role: 'REVIEWER',
      });
    });

    it('should return generic UnauthorizedException for unknown email', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        controller.login({
          email: 'missing@example.com',
          password: 'correct-password',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(passwordHashService.hashPassword).toHaveBeenCalledWith('correct-password');
      expect(passwordHashService.verifyPassword).not.toHaveBeenCalled();
    });

    it('should return generic UnauthorizedException for user without password hash', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        name: 'test',
        role: 'REVIEWER',
        passwordHash: null,
      });

      await expect(
        controller.login({
          email: 'test@example.com',
          password: 'correct-password',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(passwordHashService.hashPassword).toHaveBeenCalledWith('correct-password');
      expect(passwordHashService.verifyPassword).not.toHaveBeenCalled();
    });

    it('should return generic UnauthorizedException for wrong password', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        name: 'test',
        role: 'REVIEWER',
        passwordHash: 'scrypt$stored',
      });
      (passwordHashService.verifyPassword as jest.Mock).mockResolvedValue(false);

      await expect(
        controller.login({
          email: 'test@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject invalid password shape with 400', async () => {
      await expect(
        controller.login({ email: 'test@example.com', password: 'short' }),
      ).rejects.toThrow(BadRequestException);
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('devLogin', () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
      originalEnv = process.env.ENABLE_DEV_LOGIN;
    });

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.ENABLE_DEV_LOGIN;
      } else {
        process.env.ENABLE_DEV_LOGIN = originalEnv;
      }
    });

    it('should throw ForbiddenException if explicitly disabled', async () => {
      process.env.ENABLE_DEV_LOGIN = 'false';
      await expect(controller.devLogin({ email: 'test@example.com' })).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if not enabled and not in local dev', async () => {
      delete process.env.ENABLE_DEV_LOGIN;
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      await expect(controller.devLogin({ email: 'test@example.com' })).rejects.toThrow(ForbiddenException);
      
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should create user and issue token if ENABLE_DEV_LOGIN is true', async () => {
      process.env.ENABLE_DEV_LOGIN = 'true';
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.user.create as jest.Mock).mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        name: 'test',
        role: 'ADMIN',
      });

      const result = await controller.devLogin({ email: 'test@example.com' });

      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: { email: 'test@example.com', name: 'test', role: 'ADMIN' },
      });
      expect(result.accessToken).toBe('mocked-token');
      expect(result.user).toEqual({
        id: 'user-id',
        email: 'test@example.com',
        name: 'test',
        role: 'ADMIN',
      });
    });

    it('should reject invalid email with 400 if ENABLE_DEV_LOGIN is true', async () => {
      process.env.ENABLE_DEV_LOGIN = 'true';

      await expect(
        controller.devLogin({ email: 'not-an-email', role: 'ADMIN' }),
      ).rejects.toThrow(BadRequestException);
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should reject invalid role with 400 if ENABLE_DEV_LOGIN is true', async () => {
      process.env.ENABLE_DEV_LOGIN = 'true';

      await expect(
        controller.devLogin({ email: 'test@example.com', role: 'OWNER' as any }),
      ).rejects.toThrow(BadRequestException);
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should reject missing email with 400 if ENABLE_DEV_LOGIN is true', async () => {
      process.env.ENABLE_DEV_LOGIN = 'true';

      await expect(
        controller.devLogin({ role: 'ADMIN' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should update role if requested role differs from existing user role', async () => {
      process.env.ENABLE_DEV_LOGIN = 'true';
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        name: 'test',
        role: 'VIEWER',
      });
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        name: 'test',
        role: 'ADMIN',
      });

      const result = await controller.devLogin({ email: 'test@example.com', role: 'ADMIN' });

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        data: { role: 'ADMIN' },
      });
      expect(result.user.role).toBe('ADMIN');
    });
  });
});
