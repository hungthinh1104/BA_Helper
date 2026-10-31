import type { PrismaService } from '@ba-helper/backend-runtime';
import { resetDatabase } from './reset-db';

function createPrismaStub(executeRawUnsafe: jest.Mock) {
  return {
    $queryRaw: jest.fn().mockImplementation((query: TemplateStringsArray) => query.join('').includes('pg_stat_activity')
      ? [{ database: 'ba_helper_test', port: 5432, lease_held: true }]
      : [{ tablename: 'Project' }]),
    $executeRawUnsafe: executeRawUnsafe,
  } as unknown as PrismaService;
}

describe('resetDatabase', () => {
  const savedEnvironment = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, {
      DATABASE_URL_TEST: 'postgresql://test:test@localhost:5432/ba_helper_test',
      BA_HELPER_TEST_DATABASE_IDENTITY: 'localhost:5432/ba_helper_test',
      REDIS_URL_TEST: 'redis://localhost:6379/1',
      BA_HELPER_DEVELOPMENT_REDIS_URL: 'redis://localhost:6379/0',
      BA_HELPER_TEST_LEASE_ID: '12345678-1234-4234-8234-123456789abc',
      BA_HELPER_TEST_LEASE_PID: '1234',
      BA_HELPER_TEST_LEASE_APP_NAME: 'ba-helper-test-lease-12345678-1234-4234-8234-123456789abc',
    });
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) if (!(key in savedEnvironment)) delete process.env[key];
    Object.assign(process.env, savedEnvironment);
  });

  it.each([
    {
      name: 'PostgreSQL deadlock',
      error: Object.assign(new Error('deadlock detected'), { code: '40P01' }),
    },
    {
      name: 'PostgreSQL connection timeout',
      error: new Error('timeout exceeded when trying to connect'),
    },
  ])('retries a transient reset error: $name', async ({ error }) => {
    const executeRawUnsafe = jest.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(1);

    await expect(resetDatabase(createPrismaStub(executeRawUnsafe))).resolves.toBeUndefined();

    expect(executeRawUnsafe).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-transient reset errors', async () => {
    const executeRawUnsafe = jest.fn().mockRejectedValue(new Error('permission denied'));

    await expect(resetDatabase(createPrismaStub(executeRawUnsafe))).rejects.toThrow('permission denied');

    expect(executeRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it('rejects a missing live lease before any reset mutation', async () => {
    const executeRawUnsafe = jest.fn();
    const prisma = createPrismaStub(executeRawUnsafe);
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ database: 'ba_helper_test', port: 5432, lease_held: false }]);

    await expect(resetDatabase(prisma)).rejects.toThrow(/matching local test database lease/);
    expect(executeRawUnsafe).not.toHaveBeenCalled();
  });
});
