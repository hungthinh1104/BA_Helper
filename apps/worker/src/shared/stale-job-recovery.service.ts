import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '@ba-helper/backend-runtime/prisma';

const DEFAULT_LEASE_MS = 15 * 60 * 1000;

/**
 * How long a job may sit in RUNNING with no progress before it is considered
 * orphaned. Kept generous so a genuinely in-flight job is never reaped; a worker
 * crash leaves rows RUNNING with an `updatedAt` that ages past this lease.
 */
export function resolveStaleJobLeaseMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.STALE_JOB_RECOVERY_LEASE_MS);
  return Number.isInteger(raw) && raw >= 0 ? raw : DEFAULT_LEASE_MS;
}

export interface StaleJobRecoverySummary {
  scanJobs: number;
  impactAnalyses: number;
  documentJobs: number;
}

/**
 * Domain-state recovery for jobs orphaned by a worker crash.
 *
 * BullMQ recovers stalled *queue* jobs on its own, but the product rows
 * (`ScanJob`, `ImpactAnalysis`, `DocumentJob`) can be left stuck in RUNNING with
 * nothing to move them. On worker start we fail those stale-RUNNING rows so they
 * stop blocking the pipeline and become visible/retryable.
 */
@Injectable()
export class StaleJobRecoveryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StaleJobRecoveryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    const summary = await this.recoverStaleRunningJobs();
    const total = summary.scanJobs + summary.impactAnalyses + summary.documentJobs;
    if (total > 0) {
      this.logger.warn(
        JSON.stringify({ event: 'STALE_JOB_RECOVERY', ...summary }),
      );
    }
  }

  async recoverStaleRunningJobs(params?: {
    now?: Date;
    leaseMs?: number;
  }): Promise<StaleJobRecoverySummary> {
    const now = params?.now ?? new Date();
    const leaseMs = params?.leaseMs ?? resolveStaleJobLeaseMs();
    const cutoff = new Date(now.getTime() - leaseMs);
    const staleFilter = { status: 'RUNNING' as const, updatedAt: { lt: cutoff } };

    const [scanJobs, impactAnalyses, documentJobs] = await this.prisma.$transaction([
      this.prisma.scanJob.updateMany({
        where: staleFilter,
        data: { status: 'FAILED' },
      }),
      this.prisma.impactAnalysis.updateMany({
        where: staleFilter,
        data: { status: 'FAILED' },
      }),
      this.prisma.documentJob.updateMany({
        where: staleFilter,
        data: { status: 'FAILED' },
      }),
    ]);

    return {
      scanJobs: scanJobs.count,
      impactAnalyses: impactAnalyses.count,
      documentJobs: documentJobs.count,
    };
  }
}
