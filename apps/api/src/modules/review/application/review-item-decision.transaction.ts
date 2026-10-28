import { AppError } from '@ba-helper/shared';
import type { Prisma } from '@prisma/client';
import type {
  EventLogService,
  InsightRepository,
  PrismaService,
  ReviewNoteRepository,
  TraceabilityRepository,
} from '@ba-helper/backend-runtime';

export async function persistTraceabilityReviewDecision(params: {
  traceabilityRepo: TraceabilityRepository;
  eventLog: EventLogService;
  prisma: PrismaService;
  analysisId: string;
  itemId: string;
  decision: 'ACCEPTED' | 'REJECTED' | 'NEEDS_MORE_EVIDENCE';
  note: string | null;
  actorId: string;
}) {
  await params.prisma.$transaction(async (transaction) => {
    const updated = await params.traceabilityRepo.upsertReviewDecision({
      linkId: params.itemId,
      analysisId: params.analysisId,
      decision: params.decision,
      note: params.note,
      reviewedByUserId: params.actorId,
    }, transaction);
    if (!updated) {
      throw new AppError(
        'INVALID_STATE_TRANSITION',
        'Analysis was finalized before the review decision could be saved.',
      );
    }
    await recordReviewEvent(params.eventLog, transaction, {
      eventType: 'TRACEABILITY_REVIEW_DECISION_UPDATED',
      analysisId: params.analysisId,
      itemId: params.itemId,
      state: params.decision,
      actorId: params.actorId,
      payload: { target: 'impact', action: decisionAction(params.decision), decision: params.decision },
    });
  });
}

export async function removeTraceabilityReviewDecision(params: {
  traceabilityRepo: TraceabilityRepository;
  eventLog: EventLogService;
  prisma: PrismaService;
  analysisId: string;
  itemId: string;
  actorId: string;
}) {
  await params.prisma.$transaction(async (transaction) => {
    const deleted = await params.traceabilityRepo.deleteReviewDecision(
      params.itemId,
      params.analysisId,
      transaction,
    );
    if (!deleted) {
      throw new AppError(
        'INVALID_STATE_TRANSITION',
        'Analysis was finalized before the review decision could be cleared.',
      );
    }
    await recordReviewEvent(params.eventLog, transaction, {
      eventType: 'TRACEABILITY_REVIEW_DECISION_DELETED',
      analysisId: params.analysisId,
      itemId: params.itemId,
      state: 'undo',
      actorId: params.actorId,
      payload: { target: 'impact', action: 'undo' },
    });
  });
}

export async function persistInsightReviewDecision(params: {
  traceabilityRepo: TraceabilityRepository;
  insightRepo: InsightRepository;
  reviewNoteRepo: ReviewNoteRepository;
  eventLog: EventLogService;
  prisma: PrismaService;
  analysisId: string;
  itemId: string;
  currentStatus: 'NEEDS_REVIEW' | 'CONFIRMED' | 'REJECTED';
  targetStatus: 'NEEDS_REVIEW' | 'CONFIRMED' | 'REJECTED';
  targetNote: string | null;
  expectedCommitSha: string;
  expectedTargetCommitSha: string;
  expectedResolvedRefType: 'BRANCH' | 'TAG' | 'COMMIT';
  action: 'accept' | 'reject' | 'undo';
  actorId: string;
}) {
  await params.prisma.$transaction(async (transaction) => {
    if (params.currentStatus !== params.targetStatus) {
      await updateInsightStatus(params, transaction);
    }
    await saveInsightReviewNote(params, transaction);
    await recordReviewEvent(params.eventLog, transaction, {
      eventType: 'INSIGHT_REVIEWED',
      analysisId: params.analysisId,
      itemId: params.itemId,
      state: params.action === 'undo' ? 'undo' : params.targetStatus,
      actorId: params.actorId,
      payload: {
        target: 'insight',
        action: params.action,
        reviewStatus: params.targetStatus,
      },
    });
  });
}

async function updateInsightStatus(
  params: Parameters<typeof persistInsightReviewDecision>[0],
  transaction: Prisma.TransactionClient,
) {
  const result = await params.insightRepo.updateReviewStatusIfCurrent({
    insightId: params.itemId,
    reviewStatus: params.targetStatus,
    expectedCommitSha: params.expectedCommitSha,
    expectedTargetCommitSha: params.expectedTargetCommitSha,
    expectedResolvedRefType: params.expectedResolvedRefType,
  }, transaction);
  if (result.count > 0) return;

  const insight = await params.insightRepo.findById(params.itemId, transaction);
  if (insight?.impactAnalysis.status === 'COMPLETED' || insight?.impactAnalysis.status === 'CANCELLED') {
    throw new AppError(
      'INVALID_STATE_TRANSITION',
      'Analysis was finalized before the review decision could be saved.',
    );
  }
  throw new AppError('REVIEW_NOT_ALLOWED', 'Review became stale during update.');
}

async function saveInsightReviewNote(
  params: Parameters<typeof persistInsightReviewDecision>[0],
  transaction: Prisma.TransactionClient,
) {
  if (params.targetNote === null) {
    const deleted = await params.reviewNoteRepo.clear({
      impactAnalysisId: params.analysisId,
      insightId: params.itemId,
    }, transaction);
    if (!deleted) {
      throw new AppError(
        'REVIEW_NOT_ALLOWED',
        'Analysis was finalized before the review note could be cleared.',
      );
    }
    return;
  }

  const note = await params.reviewNoteRepo.upsert({
    impactAnalysisId: params.analysisId,
    insightId: params.itemId,
    body: params.targetNote,
  }, transaction);
  if (!note) {
    throw new AppError(
      'REVIEW_NOT_ALLOWED',
      'Analysis was finalized before the review note could be saved.',
    );
  }
}

async function recordReviewEvent(
  eventLog: EventLogService,
  transaction: Prisma.TransactionClient,
  params: {
    eventType: string;
    analysisId: string;
    itemId: string;
    state: string;
    actorId: string;
    payload: Record<string, unknown>;
  },
) {
  await eventLog.recordEvent({
    eventType: params.eventType,
    idempotencyKey: `impact:${params.analysisId}:review-item:${params.itemId}:${params.state}`,
    payload: { ...params.payload, analysisId: params.analysisId, itemId: params.itemId },
    actorUserId: params.actorId,
  }, transaction);
}

function decisionAction(decision: 'ACCEPTED' | 'REJECTED' | 'NEEDS_MORE_EVIDENCE') {
  if (decision === 'ACCEPTED') return 'accept';
  if (decision === 'REJECTED') return 'reject';
  return 'needs_more_evidence';
}
