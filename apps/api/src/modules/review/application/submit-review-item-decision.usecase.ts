import { createHash } from 'node:crypto';
import { AppError } from '@ba-helper/shared';
import type {
  ReviewItemDecisionTarget,
  SubmitReviewItemDecisionResponse,
} from '@ba-helper/contracts';
import { ReviewPolicy } from '../../review/domain/review.policy';
import type {
  TraceabilityRepository,
  InsightRepository,
  ReviewNoteRepository,
  EventLogService,
  PrismaService,
} from '@ba-helper/backend-runtime';
import {
  persistInsightReviewDecision,
  persistTraceabilityReviewDecision,
  removeTraceabilityReviewDecision,
} from './review-item-decision.transaction';
import {
  mapImpactReviewDecision,
  mapInsightReviewDecision,
} from './review-item-decision-response.mapper';

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
 * reviewer rationale for both and supports undo for both. A stable command key
 * prevents late retries from overriding newer decisions; each new command also
 * receives an attributed audit event or a no-op receipt.
 */
export class SubmitReviewItemDecisionUseCase {
  constructor(
    private readonly traceabilityRepo: TraceabilityRepository,
    private readonly insightRepo: InsightRepository,
    private readonly reviewNoteRepo: ReviewNoteRepository,
    private readonly eventLog: EventLogService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(params: {
    analysisId: string;
    itemId: string;
    target: ReviewItemDecisionTarget;
    action: ReviewAction;
    rationale?: string | null;
    requestKey: string;
    actorId: string;
  }): Promise<SubmitReviewItemDecisionResponse> {
    const note = params.rationale?.trim() ? params.rationale.trim() : null;
    const commandFingerprint = fingerprintReviewCommand({
      analysisId: params.analysisId,
      itemId: params.itemId,
      target: params.target,
      action: params.action,
      note,
      actorId: params.actorId,
    });
    if (params.target === 'impact') {
      return this.decideImpact({ ...params, note, commandFingerprint });
    }
    return this.decideInsight({ ...params, note, commandFingerprint });
  }

  private async decideImpact(params: {
    analysisId: string;
    itemId: string;
    action: ReviewAction;
    note: string | null;
    requestKey: string;
    commandFingerprint: string;
    actorId: string;
  }): Promise<SubmitReviewItemDecisionResponse> {
    const link = await this.traceabilityRepo.findById(params.itemId);
    if (!link) {
      throw new AppError('REVIEW_NOT_ALLOWED', 'Traceability link not found.');
    }
    const analysis = link.impactAnalysis;
    this.assertItemInAnalysis(analysis.id, params.analysisId);
    ReviewPolicy.assertCanReview(analysis);

    if (params.action === 'undo') {
      const changed = await removeTraceabilityReviewDecision({
        traceabilityRepo: this.traceabilityRepo,
        eventLog: this.eventLog,
        prisma: this.prisma,
        analysisId: analysis.id,
        itemId: params.itemId,
        requestKey: params.requestKey,
        commandFingerprint: params.commandFingerprint,
        actorId: params.actorId,
      });
      if (!changed) return this.readCurrentImpactDecision(params.analysisId, params.itemId);
      return mapImpactReviewDecision(params.itemId, 'NEEDS_REVIEW', null, false);
    }

    const decision = IMPACT_DECISION[params.action];
    const changed = await persistTraceabilityReviewDecision({
      traceabilityRepo: this.traceabilityRepo,
      eventLog: this.eventLog,
      prisma: this.prisma,
      analysisId: analysis.id,
      itemId: params.itemId,
      decision,
      note: params.note,
      requestKey: params.requestKey,
      commandFingerprint: params.commandFingerprint,
      actorId: params.actorId,
    });
    if (!changed) return this.readCurrentImpactDecision(params.analysisId, params.itemId);
    return mapImpactReviewDecision(params.itemId, decision, params.note, false);
  }

  private async decideInsight(params: {
    analysisId: string;
    itemId: string;
    action: ReviewAction;
    note: string | null;
    requestKey: string;
    commandFingerprint: string;
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
    const changed = await persistInsightReviewDecision({
      traceabilityRepo: this.traceabilityRepo,
      insightRepo: this.insightRepo,
      reviewNoteRepo: this.reviewNoteRepo,
      eventLog: this.eventLog,
      prisma: this.prisma,
      analysisId: analysis.id,
      itemId: params.itemId,
      requestKey: params.requestKey,
      commandFingerprint: params.commandFingerprint,
      targetStatus,
      targetNote,
      expectedCommitSha: analysis.snapshot.commitSha,
      expectedTargetCommitSha: analysis.sourceTarget.latestObservedCommitSha,
      expectedResolvedRefType: analysis.sourceTarget.resolvedRefType as
        | 'BRANCH'
        | 'TAG'
        | 'COMMIT',
      action: params.action,
      actorId: params.actorId,
    });
    if (!changed) return this.readCurrentInsightDecision(params.analysisId, params.itemId);
    return mapInsightReviewDecision(params.itemId, targetStatus, targetNote, false);
  }

  private async readCurrentImpactDecision(
    analysisId: string,
    itemId: string,
  ): Promise<SubmitReviewItemDecisionResponse> {
    const current = await this.traceabilityRepo.findById(itemId);
    if (!current || current.impactAnalysis.id !== analysisId) {
      throw new AppError('REVIEW_NOT_ALLOWED', 'Traceability link not found.');
    }
    return mapImpactReviewDecision(
      itemId,
      current.reviewDecision?.decision ?? 'NEEDS_REVIEW',
      current.reviewDecision?.note ?? null,
      true,
    );
  }

  private async readCurrentInsightDecision(
    analysisId: string,
    itemId: string,
  ): Promise<SubmitReviewItemDecisionResponse> {
    const current = await this.insightRepo.findById(itemId);
    if (!current || current.impactAnalysis.id !== analysisId) {
      throw new AppError('REVIEW_NOT_ALLOWED', 'Insight not found.');
    }
    return mapInsightReviewDecision(
      itemId,
      current.reviewStatus,
      current.reviewNote?.body ?? null,
      true,
    );
  }

  private assertItemInAnalysis(itemAnalysisId: string, requestedAnalysisId: string) {
    if (requestedAnalysisId && itemAnalysisId !== requestedAnalysisId) {
      throw new AppError(
        'REVIEW_NOT_ALLOWED',
        'Review item does not belong to the requested analysis.',
      );
    }
  }

}

function fingerprintReviewCommand(params: {
  analysisId: string;
  itemId: string;
  target: ReviewItemDecisionTarget;
  action: ReviewAction;
  note: string | null;
  actorId: string;
}): string {
  return createHash('sha256').update(JSON.stringify(params)).digest('hex');
}
