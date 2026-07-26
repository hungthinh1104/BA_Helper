import { AppError } from '@ba-helper/shared';
import type {
  ReviewItemDecisionTarget,
  SubmitReviewItemDecisionResponse,
} from '@ba-helper/contracts';
import { ReviewPolicy } from '../../review/domain/review.policy';
import {
  TraceabilityRepository,
  InsightRepository,
  ReviewNoteRepository,
  EventLogService,
} from '@ba-helper/backend-runtime';

type ReviewAction = 'accept' | 'reject' | 'needs_more_evidence' | 'undo';

const IMPACT_DECISION: Record<
  Exclude<ReviewAction, 'undo'>,
  'ACCEPTED' | 'REJECTED' | 'NEEDS_MORE_EVIDENCE'
> = {
  accept: 'ACCEPTED',
  reject: 'REJECTED',
  needs_more_evidence: 'NEEDS_MORE_EVIDENCE',
};

const INSIGHT_STATUS: Record<'accept' | 'reject', 'CONFIRMED' | 'REJECTED'> = {
  accept: 'CONFIRMED',
  reject: 'REJECTED',
};

/**
 * The single, target-aware entry point for mutating a review item's decision.
 * It dispatches to the traceability (impact) or insight persistence, records the
 * reviewer rationale for both, supports undo for both, is idempotent (a request
 * matching the persisted state performs no write and emits no duplicate audit),
 * and writes a deterministic audit event attributed to the actor.
 */
export class SubmitReviewItemDecisionUseCase {
  constructor(
    private readonly traceabilityRepo: TraceabilityRepository,
    private readonly insightRepo: InsightRepository,
    private readonly reviewNoteRepo: ReviewNoteRepository,
    private readonly eventLog: EventLogService,
  ) {}

  async execute(params: {
    analysisId: string;
    itemId: string;
    target: ReviewItemDecisionTarget;
    action: ReviewAction;
    rationale?: string | null;
    actorId: string;
  }): Promise<SubmitReviewItemDecisionResponse> {
    const note = params.rationale?.trim() ? params.rationale.trim() : null;
    if (params.target === 'impact') {
      return this.decideImpact({ ...params, note });
    }
    return this.decideInsight({ ...params, note });
  }

  private async decideImpact(params: {
    analysisId: string;
    itemId: string;
    action: ReviewAction;
    note: string | null;
    actorId: string;
  }): Promise<SubmitReviewItemDecisionResponse> {
    const link = await this.traceabilityRepo.findById(params.itemId);
    if (!link) {
      throw new AppError('REVIEW_NOT_ALLOWED', 'Traceability link not found.');
    }
    const analysis = link.impactAnalysis;
    this.assertItemInAnalysis(analysis.id, params.analysisId);
    ReviewPolicy.assertCanReview(analysis);

    const existing = link.reviewDecision;

    if (params.action === 'undo') {
      if (!existing) {
        return this.impactResult(params.itemId, 'NEEDS_REVIEW', null, true);
      }
      await this.traceabilityRepo.deleteReviewDecision(params.itemId);
      await this.audit({
        eventType: 'TRACEABILITY_REVIEW_DECISION_DELETED',
        analysisId: analysis.id,
        itemId: params.itemId,
        state: 'undo',
        actorId: params.actorId,
        payload: { target: 'impact', action: 'undo' },
      });
      return this.impactResult(params.itemId, 'NEEDS_REVIEW', null, false);
    }

    const decision = IMPACT_DECISION[params.action];
    if (
      existing &&
      existing.decision === decision &&
      (existing.note ?? null) === params.note
    ) {
      return this.impactResult(params.itemId, decision, params.note, true);
    }

    await this.traceabilityRepo.upsertReviewDecision({
      linkId: params.itemId,
      analysisId: analysis.id,
      decision,
      note: params.note,
      reviewedByUserId: params.actorId,
    });
    await this.audit({
      eventType: 'TRACEABILITY_REVIEW_DECISION_UPDATED',
      analysisId: analysis.id,
      itemId: params.itemId,
      state: decision,
      actorId: params.actorId,
      payload: { target: 'impact', action: params.action, decision },
    });
    return this.impactResult(params.itemId, decision, params.note, false);
  }

  private async decideInsight(params: {
    analysisId: string;
    itemId: string;
    action: ReviewAction;
    note: string | null;
    actorId: string;
  }): Promise<SubmitReviewItemDecisionResponse> {
    if (params.action === 'needs_more_evidence') {
      throw new AppError(
        'REVIEW_NOT_ALLOWED',
        'needs_more_evidence is not supported for insight items.',
      );
    }

    const insight = await this.insightRepo.findById(params.itemId);
    if (!insight) {
      throw new AppError('REVIEW_NOT_ALLOWED', 'Insight not found.');
    }
    const analysis = insight.impactAnalysis;
    this.assertItemInAnalysis(analysis.id, params.analysisId);
    ReviewPolicy.assertCanReview(analysis);

    const targetStatus =
      params.action === 'undo' ? 'NEEDS_REVIEW' : INSIGHT_STATUS[params.action];
    const targetNote = params.action === 'undo' ? null : params.note;
    const currentNote = insight.reviewNote?.body ?? null;

    if (insight.reviewStatus === targetStatus && currentNote === targetNote) {
      return this.insightResult(params.itemId, targetStatus, targetNote, true);
    }

    if (insight.reviewStatus !== targetStatus) {
      const result = await this.insightRepo.updateReviewStatusIfCurrent({
        insightId: params.itemId,
        reviewStatus: targetStatus,
        expectedCommitSha: analysis.snapshot.commitSha,
        expectedTargetCommitSha: analysis.sourceTarget.latestObservedCommitSha,
        expectedResolvedRefType: analysis.sourceTarget.resolvedRefType as
          | 'BRANCH'
          | 'TAG'
          | 'COMMIT',
      });
      if (result.count === 0) {
        throw new AppError(
          'REVIEW_NOT_ALLOWED',
          'Review became stale during update.',
        );
      }
    }

    if (targetNote === null) {
      await this.reviewNoteRepo.clear({
        impactAnalysisId: analysis.id,
        insightId: params.itemId,
      });
    } else {
      await this.reviewNoteRepo.upsert({
        impactAnalysisId: analysis.id,
        insightId: params.itemId,
        body: targetNote,
      });
    }

    await this.audit({
      eventType: 'INSIGHT_REVIEWED',
      analysisId: analysis.id,
      itemId: params.itemId,
      state: params.action === 'undo' ? 'undo' : targetStatus,
      actorId: params.actorId,
      payload: {
        target: 'insight',
        action: params.action,
        reviewStatus: targetStatus,
      },
    });
    return this.insightResult(params.itemId, targetStatus, targetNote, false);
  }

  private assertItemInAnalysis(itemAnalysisId: string, requestedAnalysisId: string) {
    if (requestedAnalysisId && itemAnalysisId !== requestedAnalysisId) {
      throw new AppError(
        'REVIEW_NOT_ALLOWED',
        'Review item does not belong to the requested analysis.',
      );
    }
  }

  private async audit(params: {
    eventType: string;
    analysisId: string;
    itemId: string;
    state: string;
    actorId: string;
    payload: Record<string, unknown>;
  }) {
    await this.eventLog.recordEvent({
      eventType: params.eventType,
      idempotencyKey: `impact:${params.analysisId}:review-item:${params.itemId}:${params.state}`,
      payload: { ...params.payload, analysisId: params.analysisId, itemId: params.itemId },
      actorUserId: params.actorId,
    });
  }

  private impactResult(
    itemId: string,
    decision: string,
    note: string | null,
    idempotent: boolean,
  ): SubmitReviewItemDecisionResponse {
    return {
      itemId,
      target: 'impact',
      currentDecision: toDecision(decision),
      reviewNote: note,
      idempotent,
    };
  }

  private insightResult(
    itemId: string,
    status: string,
    note: string | null,
    idempotent: boolean,
  ): SubmitReviewItemDecisionResponse {
    return {
      itemId,
      target: 'insight',
      currentDecision: toDecision(status),
      reviewNote: note,
      idempotent,
    };
  }
}

function toDecision(
  value: string,
): SubmitReviewItemDecisionResponse['currentDecision'] {
  if (value === 'ACCEPTED' || value === 'CONFIRMED') return 'accepted';
  if (value === 'REJECTED') return 'rejected';
  if (value === 'NEEDS_MORE_EVIDENCE') return 'needs_more_evidence';
  return 'needs_review';
}
