import type { PrismaService } from '../../prisma/prisma.service';
import type { QueueService } from '../../queue/queue.service';
import { getRuntimeConfig } from '../../../bootstrap/runtime-config';

export class GetSystemHealthUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async execute() {
    const config = getRuntimeConfig(process.env);
    const database = await this.checkDatabase();
    const pgvector = database ? await this.checkPgvector() : false;
    const queueHealth = await this.queueService.checkQueueHealth();
    const redis = queueHealth.redis;
    const queue = queueHealth.queue;
    const operations = await this.queueService.getOperationsHealthSummary();
    const status =
      database &&
      pgvector &&
      redis &&
      queue &&
      operations.scanJobs.status === 'up' &&
      operations.analysisJobs.status === 'up' &&
      operations.documentJobs.status === 'up'
        ? 'ok'
        : 'degraded';

    return {
      apiVersion: config.apiVersion,
      dependencies: {
        database: database ? 'up' : 'down',
        pgvector: pgvector ? 'up' : 'down',
        queue: queue ? 'up' : 'down',
        redis: redis ? 'up' : 'down',
      },
      operations,
      serverTime: new Date().toISOString(),
      status,
      workspaceMode: config.workspaceMode,
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkPgvector(): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRaw<{ extname: string }[]>`
        SELECT extname FROM pg_extension WHERE extname = 'vector'
      `;
      return result.length > 0;
    } catch {
      return false;
    }
  }
}
