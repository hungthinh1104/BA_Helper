import {
  type SystemDependencies,
  type SystemLivenessResponse,
  type SystemOperationsResponse,
  type SystemReadinessResponse,
  workspaceModeSchema,
} from '@ba-helper/contracts';
import { getRuntimeConfig } from '../../../bootstrap/runtime-config';
import { PrismaService, QueueService } from '@ba-helper/backend-runtime';

export class GetSystemHealthUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Liveness — process only. Safe for unauthenticated probes; no dependency or
   * operational detail is checked or returned.
   */
  getLiveness(): SystemLivenessResponse {
    const config = getRuntimeConfig(process.env);
    return {
      status: 'ok',
      serverTime: new Date().toISOString(),
      apiVersion: config.apiVersion,
    };
  }

  /**
   * Readiness — dependency up/down only. No workspace config, no queue counts, so
   * it is safe on a public endpoint.
   */
  async getReadiness(): Promise<SystemReadinessResponse> {
    const config = getRuntimeConfig(process.env);
    const dependencies = await this.checkDependencies();
    return {
      status: this.rollUp(dependencies),
      serverTime: new Date().toISOString(),
      apiVersion: config.apiVersion,
      dependencies,
    };
  }

  /**
   * Operations — dependency health plus queue counts, failed-job data, and
   * workspace configuration. ADMIN only; never exposed publicly.
   */
  async getOperations(): Promise<SystemOperationsResponse> {
    const config = getRuntimeConfig(process.env);
    const dependencies = await this.checkDependencies();
    const operations = await this.queueService.getOperationsHealthSummary();
    const status =
      this.rollUp(dependencies) === 'ok' &&
      operations.scanJobs.status === 'up' &&
      operations.analysisJobs.status === 'up' &&
      operations.documentJobs.status === 'up'
        ? 'ok'
        : 'degraded';
    return {
      status,
      serverTime: new Date().toISOString(),
      apiVersion: config.apiVersion,
      workspaceMode: workspaceModeSchema.parse(config.workspaceMode),
      dependencies,
      operations,
    };
  }

  private async checkDependencies(): Promise<SystemDependencies> {
    const database = await this.checkDatabase();
    const pgvector = database ? await this.checkPgvector() : false;
    const queueHealth = await this.queueService.checkQueueHealth();
    return {
      database: database ? 'up' : 'down',
      pgvector: pgvector ? 'up' : 'down',
      queue: queueHealth.queue ? 'up' : 'down',
      redis: queueHealth.redis ? 'up' : 'down',
    };
  }

  private rollUp(dependencies: SystemDependencies): 'ok' | 'degraded' {
    return Object.values(dependencies).every((value) => value === 'up')
      ? 'ok'
      : 'degraded';
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
