import type { Logger } from '@nestjs/common';
import { ImpactAnalysisPolicy } from '../../domain/impact-analysis.policy';
import type {
  EventLogService,
  ImpactAnalysisRepository,
  QueueService,
} from '@ba-helper/backend-runtime';

type ExistingImpactAnalysis = NonNullable<
  Awaited<ReturnType<ImpactAnalysisRepository['findByComposite']>>
>;

type AnalysisQueueIdentity = Pick<
  ExistingImpactAnalysis,
  'id' | 'requirementRevisionId' | 'snapshotId'
>;

type ExistingAnalysisRequest = {
  requirementRevisionId: string;
  snapshotId: string;
  sourceTargetId: string;
  requestKey: string;
  actorUserId?: string;
};

type QueueDependencies = {
  impactRepo: ImpactAnalysisRepository;
  eventLog: EventLogService;
  queue: QueueService;
  logger: Pick<Logger, 'error'>;
};

export async function reuseExistingImpactAnalysis(
  params: ExistingAnalysisRequest,
  existing: ExistingImpactAnalysis,
  dependencies: QueueDependencies,
): Promise<ExistingImpactAnalysis> {
  if (existing.status === 'QUEUED') {
    await ensureImpactAnalysisQueued(existing, dependencies);
    return existing;
  }

  if (!ImpactAnalysisPolicy.canRetryQueueEnqueueFailure({
    status: existing.status,
    errorCode: readErrorCode(existing.error),
  })) return existing;

  await dependencies.eventLog.recordEvent({
    eventType: 'IMPACT_ANALYSIS_QUEUE_RETRY_REQUESTED',
    idempotencyKey: `impact:${existing.id}:queue-retry:${existing.updatedAt.toISOString()}`,
    actorUserId: params.actorUserId,
    payload: {
      impactAnalysisId: existing.id,
      requestKey: params.requestKey,
      previousStatus: 'FAILED',
      nextStatus: 'QUEUED',
      errorCode: 'QUEUE_ENQUEUE_FAILED',
    },
  });
  await dependencies.impactRepo.requeueQueueEnqueueFailure(existing.id);

  const current = await dependencies.impactRepo.findByComposite(params);
  if (current?.status === 'QUEUED') {
    await ensureImpactAnalysisQueued(current, dependencies);
  }
  return current ?? existing;
}

export async function ensureImpactAnalysisQueued(
  analysis: AnalysisQueueIdentity,
  dependencies: QueueDependencies,
): Promise<void> {
  await dependencies.eventLog.recordEvent({
    eventType: 'IMPACT_ANALYSIS_QUEUED',
    idempotencyKey: `impact:${analysis.id}:queued`,
    payload: {
      impactAnalysisId: analysis.id,
      requirementRevisionId: analysis.requirementRevisionId,
      snapshotId: analysis.snapshotId,
    },
  });

  try {
    await dependencies.queue.enqueueImpactAnalysis(analysis.id);
  } catch (error) {
    await dependencies.impactRepo.updateStatus({
      id: analysis.id,
      status: 'FAILED',
      stage: 'DONE',
      progress: 0,
      error: {
        code: 'QUEUE_ENQUEUE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to enqueue impact analysis job.',
      },
    });
    dependencies.logger.error(
      `Failed to enqueue analysis ${analysis.id}: ${(error as Error)?.message ?? error}`,
    );
    throw error;
  }
}

function readErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || Array.isArray(error)) return null;
  const code = (error as Record<string, unknown>).code;
  return typeof code === 'string' ? code : null;
}
