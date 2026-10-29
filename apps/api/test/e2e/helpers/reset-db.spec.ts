import type { PrismaService } from '@ba-helper/backend-runtime';
import { resetDatabase } from './reset-db';

function createPrismaStub(executeRawUnsafe: jest.Mock) {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ tablename: 'Project' }]),
    $executeRawUnsafe: executeRawUnsafe,
  } as unknown as PrismaService;
}

describe('resetDatabase', () => {
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
});
