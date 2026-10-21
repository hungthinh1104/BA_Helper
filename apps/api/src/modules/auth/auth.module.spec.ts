import type { DynamicModule } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuthModule } from './auth.module';

describe('AuthModule JWT initialization', () => {
  const originalEnv = { ...process.env };
  const jwtModule = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, AuthModule) as DynamicModule[])
    .find(module => module.module === JwtModule)!;

  afterEach(() => { process.env = { ...originalEnv }; });

  it('resolves the signing secret when the application initializes after configuration loads', async () => {
    process.env.JWT_SECRET = 'jwt-config-loaded-after-module-import-for-test';
    Object.assign(process.env, { NODE_ENV: 'test' });
    const module = await Test.createTestingModule({ imports: [jwtModule] }).compile();
    try {
      const token = module.get(JwtService).sign({ sub: 'test-user' });
      const verifier = new JwtService({ secret: process.env.JWT_SECRET });
      expect(verifier.verify<{ sub: string }>(token).sub).toBe('test-user');
    } finally { await module.close(); }
  });

  it('fails before serving requests if the production signing secret is missing', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    delete process.env.JWT_SECRET;
    await expect(Test.createTestingModule({ imports: [jwtModule] }).compile()).rejects.toThrow('JWT_SECRET');
  });
});
