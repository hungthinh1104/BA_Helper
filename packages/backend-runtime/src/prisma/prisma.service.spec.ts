import { PrismaService } from './prisma.service';

describe('PrismaService lifecycle', () => {
  it('opens and releases a PostgreSQL connection during module initialization', async () => {
    const release = jest.fn();
    const poolConnect = jest.fn().mockResolvedValue({ release });
    const prismaConnect = jest.fn().mockResolvedValue(undefined);
    const service = Object.create(PrismaService.prototype) as PrismaService;
    Object.defineProperties(service, {
      $connect: { value: prismaConnect },
      pool: { value: { connect: poolConnect } },
    });

    await service.onModuleInit();

    expect(prismaConnect).toHaveBeenCalledTimes(1);
    expect(poolConnect).toHaveBeenCalledTimes(1);
    expect(prismaConnect.mock.invocationCallOrder[0]).toBeLessThan(poolConnect.mock.invocationCallOrder[0]);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('fails initialization when PostgreSQL cannot provide a connection', async () => {
    const poolConnect = jest.fn().mockRejectedValue(new Error('connection refused'));
    const service = Object.create(PrismaService.prototype) as PrismaService;
    Object.defineProperties(service, {
      $connect: { value: jest.fn().mockResolvedValue(undefined) },
      pool: { value: { connect: poolConnect } },
    });

    await expect(service.onModuleInit()).rejects.toThrow('connection refused');
  });
});
