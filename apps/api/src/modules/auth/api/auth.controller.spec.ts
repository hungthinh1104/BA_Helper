import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { ForbiddenException, HttpException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let jwtService: JwtService;
  let prismaService: PrismaService;

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
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jwtService = module.get<JwtService>(JwtService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
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

    it('should throw ForbiddenException if ENABLE_DEV_LOGIN is not true', async () => {
      process.env.ENABLE_DEV_LOGIN = 'false';
      await expect(controller.devLogin({ email: 'test@example.com' })).rejects.toThrow(ForbiddenException);

      delete process.env.ENABLE_DEV_LOGIN;
      await expect(controller.devLogin({ email: 'test@example.com' })).rejects.toThrow(ForbiddenException);
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
