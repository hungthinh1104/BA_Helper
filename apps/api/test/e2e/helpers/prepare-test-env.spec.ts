import * as path from 'node:path';
import type { Client } from 'pg';
import { configureIsolatedE2EEnvironment } from './test-environment';

jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('node:child_process', () => ({ execFileSync: jest.fn() }));
jest.mock('pg', () => ({ Client: jest.fn() }));

describe('E2E database preparation', () => {
  const initialEnv = { ...process.env };
  const databaseUrl = 'postgresql://test:test@localhost:5432/ba_helper_test';
  const client = {
    connect: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue({ rowCount: 1 }),
    end: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...initialEnv };
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_TEST;
    delete process.env.REDIS_URL;
    delete process.env.REDIS_URL_TEST;
    delete process.env.BA_HELPER_DEVELOPMENT_REDIS_URL;
    const pg = await import('pg');
    jest.mocked(pg.Client).mockImplementation(() => client as unknown as Client);
  });

  afterEach(() => { process.env = { ...initialEnv }; });

  it('selects the isolated test services and prefix before application modules load', () => {
    const env: NodeJS.ProcessEnv = {
      REDIS_URL: 'redis://localhost:6379/0',
      REDIS_URL_TEST: 'redis://localhost:6379/1',
      DATABASE_URL_TEST: databaseUrl,
      AI_PROVIDER: 'openai',
      EMBEDDING_PROVIDER: 'google',
    };

    configureIsolatedE2EEnvironment(env);

    expect(env).toMatchObject({
      NODE_ENV: 'test',
      AI_PROVIDER: 'fake',
      EMBEDDING_PROVIDER: 'fake',
      BA_HELPER_DEVELOPMENT_REDIS_URL: 'redis://localhost:6379/0',
      REDIS_URL: 'redis://localhost:6379/1',
      DATABASE_URL: databaseUrl,
    });
    expect(env.BULLMQ_PREFIX).toMatch(/^ba-helper-e2e-/);
  });

  it('requires an explicit test database before touching infrastructure', async () => {
    const { prepareIsolatedTestEnv } = await import('./prepare-test-env');
    await expect(prepareIsolatedTestEnv()).rejects.toThrow('DATABASE_URL_TEST is required for tests');
    expect(client.connect).not.toHaveBeenCalled();
    const childProcess = await import('node:child_process');
    expect(childProcess.execFileSync).not.toHaveBeenCalled();
  });

  it('does not fall back to the application database URL', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@production-db.invalid:5432/ba_helper';
    process.env.REDIS_URL = 'redis://localhost:6379/0';
    process.env.REDIS_URL_TEST = 'redis://localhost:6379/1';
    const { prepareIsolatedTestEnv } = await import('./prepare-test-env');
    await expect(prepareIsolatedTestEnv()).rejects.toThrow('DATABASE_URL_TEST is required for tests');
    expect(client.connect).not.toHaveBeenCalled();
    const childProcess = await import('node:child_process');
    expect(childProcess.execFileSync).not.toHaveBeenCalled();
  });

  it('requires an explicit Redis test URL before touching infrastructure', async () => {
    process.env.DATABASE_URL_TEST = databaseUrl;
    const { prepareIsolatedTestEnv } = await import('./prepare-test-env');
    await expect(prepareIsolatedTestEnv()).rejects.toThrow(
      'REDIS_URL_TEST is required to isolate test queues',
    );
    expect(client.connect).not.toHaveBeenCalled();
    const childProcess = await import('node:child_process');
    expect(childProcess.execFileSync).not.toHaveBeenCalled();
  });

  it('rejects the development Redis database before touching infrastructure', async () => {
    process.env.DATABASE_URL_TEST = databaseUrl;
    process.env.REDIS_URL = 'redis://localhost:6379/0';
    process.env.REDIS_URL_TEST = 'redis://localhost:6379';
    const { prepareIsolatedTestEnv } = await import('./prepare-test-env');
    await expect(prepareIsolatedTestEnv()).rejects.toThrow(
      'REDIS_URL_TEST must use a different Redis database or instance',
    );
    expect(client.connect).not.toHaveBeenCalled();
    const childProcess = await import('node:child_process');
    expect(childProcess.execFileSync).not.toHaveBeenCalled();
  });

  it('compares the test Redis URL to the preserved development URL after bootstrap', async () => {
    process.env.DATABASE_URL_TEST = databaseUrl;
    process.env.BA_HELPER_DEVELOPMENT_REDIS_URL = 'redis://localhost:6379/0';
    process.env.REDIS_URL = 'redis://localhost:6379/1';
    process.env.REDIS_URL_TEST = 'redis://localhost:6379/1';
    const { prepareIsolatedTestEnv } = await import('./prepare-test-env');

    await expect(prepareIsolatedTestEnv()).resolves.toBeUndefined();
    expect(process.env.REDIS_URL).toBe('redis://localhost:6379/1');
    expect(client.connect).toHaveBeenCalledTimes(2);
  });

  it('applies the migration chain once through Node without a shell or schema push', async () => {
    process.env.DATABASE_URL_TEST = databaseUrl;
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/wrong_database';
    process.env.BA_HELPER_DEVELOPMENT_REDIS_URL = 'redis://localhost:6379/0';
    process.env.REDIS_URL = 'redis://localhost:6379/0';
    process.env.REDIS_URL_TEST = 'redis://localhost:6379/1';
    const { prepareIsolatedTestEnv } = await import('./prepare-test-env');
    await prepareIsolatedTestEnv();
    await prepareIsolatedTestEnv();
    const childProcess = await import('node:child_process');
    expect(childProcess.execFileSync).toHaveBeenCalledTimes(1);
    expect(childProcess.execFileSync).toHaveBeenCalledWith(process.execPath, [
      path.resolve('apps/api/node_modules/prisma/build/index.js'),
      'migrate', 'deploy', '--config', 'prisma.config.ts', '--schema', 'prisma/schema.prisma',
    ], expect.objectContaining({
      cwd: path.resolve('apps/api'),
      env: expect.objectContaining({ DATABASE_URL: databaseUrl }),
    }));
    expect(client.query).toHaveBeenCalledWith('CREATE EXTENSION IF NOT EXISTS vector');
    expect(process.env.REDIS_URL).toBe('redis://localhost:6379/1');
  });

  it('retries preparation after a failed migration instead of marking the schema ready', async () => {
    process.env.DATABASE_URL_TEST = databaseUrl;
    process.env.BA_HELPER_DEVELOPMENT_REDIS_URL = 'redis://localhost:6379/0';
    process.env.REDIS_URL = 'redis://localhost:6379/0';
    process.env.REDIS_URL_TEST = 'redis://localhost:6379/1';
    const childProcess = await import('node:child_process');
    jest.mocked(childProcess.execFileSync).mockImplementationOnce(() => { throw new Error('migration failed'); });
    const { prepareIsolatedTestEnv } = await import('./prepare-test-env');
    await expect(prepareIsolatedTestEnv()).rejects.toThrow('migration failed');
    await prepareIsolatedTestEnv();
    expect(childProcess.execFileSync).toHaveBeenCalledTimes(2);
  });
});
