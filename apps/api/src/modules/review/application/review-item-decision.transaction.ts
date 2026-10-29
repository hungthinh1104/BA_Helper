import { AppError } from '@ba-helper/shared';
import type { Prisma } from '@prisma/client';
import { lockReviewableAnalysisWhileCurrent } from '@ba-helper/backend-runtime';
import { hasReviewCommand, recordReviewEvent } from './review-command-idempotency';
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
  requestKey: string;
  commandFingerprint: string;
  actorId: string;
}): Promise<boolean> {
  return params.prisma.$transaction(async (transaction) => {
    if (!(await lockReviewableAnalysisWhileCurrent(transaction, params.analysisId))) {
      throw new AppError(
        'INVALID_STATE_TRANSITION',
        'Analysis was finalized before the review decision could be saved.',
      );
    }
    const currentLink = await params.traceabilityRepo.findById(params.itemId, transaction);
    if (!currentLink || currentLink.impactAnalysis.id !== params.analysisId) {
      throw new AppError('REVIEW_NOT_ALLOWED', 'Traceability link not found.');
    }
    if (await hasReviewCommand(params.eventLog, transaction, params)) return false;
    if (
      currentLink.reviewDecision?.decision === params.decision &&
      (currentLink.reviewDecision.note ?? null) === params.note
    ) {
      await recordReviewEvent(params.eventLog, transaction, {
        eventType: 'REVIEW_DECISION',
        analysisId: params.analysisId,
        itemId: params.itemId,
        state: 'no-op',
        requestKey: params.requestKey,
        commandFingerprint: params.commandFingerprint,
        actorId: params.actorId,
        payload: {
          target: 'impact',
          action: decisionAction(params.decision),
          decision: params.decision,
          outcome: 'NOOP',
        },
      });
      return false;
    }

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
      requestKey: params.requestKey,
      commandFingerprint: params.commandFingerprint,
      actorId: params.actorId,
      payload: { target: 'impact', action: decisionAction(params.decision), decision: params.decision },
    });
    return true;
  });
}

export async function removeTraceabilityReviewDecision(params: {
  traceabilityRepo: TraceabilityRepository;
  eventLog: EventLogService;
  prisma: PrismaService;
  analysisId: string;
  itemId: string;
  requestKey: string;
  commandFingerprint: string;
  actorId: string;
}): Promise<boolean> {
  return params.prisma.$transaction(async (transaction) => {
    if (!(await lockReviewableAnalysisWhileCurrent(transaction, params.analysisId))) {
      throw new AppError(
        'INVALID_STATE_TRANSITION',
        'Analysis was finalized before the review decision could be cleared.',
      );
    }
    const currentLink = await params.traceabilityRepo.findById(params.itemId, transaction);
    if (!currentLink || currentLink.impactAnalysis.id !== params.analysisId) {
      throw new AppError('REVIEW_NOT_ALLOWED', 'Traceability link not found.');
    }
    if (await hasReviewCommand(params.eventLog, transaction, params)) return false;
    if (!currentLink.reviewDecision) {
      await recordReviewEvent(params.eventLog, transaction, {
        eventType: 'REVIEW_DECISION',
        analysisId: params.analysisId,
        itemId: params.itemId,
        state: 'no-op',
        requestKey: params.requestKey,
        commandFingerprint: params.commandFingerprint,
        actorId: params.actorId,
        payload: { target: 'impact', action: 'undo', outcome: 'NOOP' },
      });
      return false;
    }

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
      requestKey: params.requestKey,
      commandFingerprint: params.commandFingerprint,
      actorId: params.actorId,
      payload: { target: 'impact', action: 'undo' },
    });
    return true;
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
  requestKey: string;
  commandFingerprint: string;
  targetStatus: 'NEEDS_REVIEW' | 'CONFIRMED' | 'REJECTED';
  targetNote: string | null;
  expectedCommitSha: string;
  expectedTargetCommitSha: string;
  expectedResolvedRefType: 'BRANCH' | 'TAG' | 'COMMIT';
  action: 'accept' | 'reject' | 'undo';
  actorId: string;
}): Promise<boolean> {
  return params.prisma.$transaction(async (transaction) => {
    if (!(await lockReviewableAnalysisWhileCurrent(transaction, params.analysisId))) {
      throw new AppError(
        'INVALID_STATE_TRANSITION',
        'Analysis was finalized before the review decision could be saved.',
      );
    }
    const currentInsight = await params.insightRepo.findById(params.itemId, transaction);
    if (!currentInsight || currentInsight.impactAnalysis.id !== params.analysisId) {
      throw new AppError('REVIEW_NOT_ALLOWED', 'Insight not found.');
    }
    if (await hasReviewCommand(params.eventLog, transaction, params)) return false;
    if (
      currentInsight.reviewStatus === params.targetStatus &&
      (currentInsight.reviewNote?.body ?? null) === params.targetNote
    ) {
      await recordReviewEvent(params.eventLog, transaction, {
        eventType: 'REVIEW_DECISION',
        analysisId: params.analysisId,
        itemId: params.itemId,
        state: 'no-op',
        requestKey: params.requestKey,
        commandFingerprint: params.commandFingerprint,
        actorId: params.actorId,
        payload: {
          target: 'insight',
          action: params.action,
          reviewStatus: params.targetStatus,
          outcome: 'NOOP',
        },
      });
      return false;
    }

    if (currentInsight.reviewStatus !== params.targetStatus) {
      await updateInsightStatus(params, transaction);
    }
    await saveInsightReviewNote(params, transaction);
    await recordReviewEvent(params.eventLog, transaction, {
      eventType: 'INSIGHT_REVIEWED',
      analysisId: params.analysisId,
      itemId: params.itemId,
      state: params.action === 'undo' ? 'undo' : params.targetStatus,
      requestKey: params.requestKey,
      commandFingerprint: params.commandFingerprint,
      actorId: params.actorId,
      payload: {
        target: 'insight',
        action: params.action,
        reviewStatus: params.targetStatus,
      },
    });
    return true;
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

function decisionAction(decision: 'ACCEPTED' | 'REJECTED' | 'NEEDS_MORE_EVIDENCE') {
  if (decision === 'ACCEPTED') return 'accept';
  if (decision === 'REJECTED') return 'reject';
  return 'needs_more_evidence';
}
