import { SubmitReviewItemDecisionUseCase } from './submit-review-item-decision.usecase';

const analysisId = 'analysis-1';

function buildAnalysis(overrides: Record<string, unknown> = {}) {
  return {
    id: analysisId,
    status: 'WAITING_FOR_REVIEW',
    snapshot: { commitSha: 'sha1' },
    sourceTarget: { resolvedRefType: 'BRANCH', latestObservedCommitSha: 'sha1' },
    ...overrides,
  };
}

function setup(overrides: {
  link?: unknown;
  insight?: unknown;
  updateCount?: number;
} = {}) {
  const traceabilityRepo = {
    findById: jest.fn().mockResolvedValue(
      overrides.link ?? {
        id: 'link-1',
        impactAnalysis: buildAnalysis(),
        reviewDecision: null,
      },
    ),
    upsertReviewDecision: jest.fn().mockResolvedValue({ id: 'dec-1' }),
    deleteReviewDecision: jest.fn().mockResolvedValue(undefined),
  };
  const insightRepo = {
    findById: jest.fn().mockResolvedValue(
      overrides.insight ?? {
        id: 'insight-1',
        reviewStatus: 'NEEDS_REVIEW',
        impactAnalysis: buildAnalysis(),
        reviewNote: null,
      },
    ),
    updateReviewStatusIfCurrent: jest
      .fn()
      .mockResolvedValue({ count: overrides.updateCount ?? 1 }),
  };
  const reviewNoteRepo = {
    upsert: jest.fn().mockResolvedValue({ id: 'note-1' }),
    clear: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const eventLog = { recordEvent: jest.fn().mockResolvedValue(undefined) };
  const useCase = new SubmitReviewItemDecisionUseCase(
    traceabilityRepo as any,
    insightRepo as any,
    reviewNoteRepo as any,
    eventLog as any,
  );
  return { useCase, traceabilityRepo, insightRepo, reviewNoteRepo, eventLog };
}

describe('SubmitReviewItemDecisionUseCase', () => {
  describe('impact (traceability) items', () => {
    it('persists an accept decision with rationale and attribution, and audits it', async () => {
      const { useCase, traceabilityRepo, eventLog } = setup();

      const result = await useCase.execute({
        analysisId,
        itemId: 'link-1',
        target: 'impact',
        action: 'accept',
        rationale: '  looks correct  ',
        actorId: 'user-1',
      });

      expect(traceabilityRepo.upsertReviewDecision).toHaveBeenCalledWith({
        linkId: 'link-1',
        analysisId,
        decision: 'ACCEPTED',
        note: 'looks correct',
        reviewedByUserId: 'user-1',
      });
      expect(eventLog.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'TRACEABILITY_REVIEW_DECISION_UPDATED',
          idempotencyKey: 'impact:analysis-1:review-item:link-1:ACCEPTED',
          actorUserId: 'user-1',
        }),
      );
      expect(result).toEqual({
        itemId: 'link-1',
        target: 'impact',
        currentDecision: 'accepted',
        reviewNote: 'looks correct',
        idempotent: false,
      });
    });

    it('maps needs_more_evidence to the traceability decision value', async () => {
      const { useCase, traceabilityRepo } = setup();
      const result = await useCase.execute({
        analysisId,
        itemId: 'link-1',
        target: 'impact',
        action: 'needs_more_evidence',
        actorId: 'user-1',
      });
      expect(traceabilityRepo.upsertReviewDecision).toHaveBeenCalledWith(
        expect.objectContaining({ decision: 'NEEDS_MORE_EVIDENCE' }),
      );
      expect(result.currentDecision).toBe('needs_more_evidence');
    });

    it('is idempotent when the decision and note already match', async () => {
      const { useCase, traceabilityRepo, eventLog } = setup({
        link: {
          id: 'link-1',
          impactAnalysis: buildAnalysis(),
          reviewDecision: { decision: 'ACCEPTED', note: 'ok' },
        },
      });

      const result = await useCase.execute({
        analysisId,
        itemId: 'link-1',
        target: 'impact',
        action: 'accept',
        rationale: 'ok',
        actorId: 'user-1',
      });

      expect(traceabilityRepo.upsertReviewDecision).not.toHaveBeenCalled();
      expect(eventLog.recordEvent).not.toHaveBeenCalled();
      expect(result.idempotent).toBe(true);
    });

    it('undo deletes the decision and audits the removal', async () => {
      const { useCase, traceabilityRepo, eventLog } = setup({
        link: {
          id: 'link-1',
          impactAnalysis: buildAnalysis(),
          reviewDecision: { decision: 'ACCEPTED', note: 'ok' },
        },
      });

      const result = await useCase.execute({
        analysisId,
        itemId: 'link-1',
        target: 'impact',
        action: 'undo',
        actorId: 'user-1',
      });

      expect(traceabilityRepo.deleteReviewDecision).toHaveBeenCalledWith('link-1');
      expect(eventLog.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'TRACEABILITY_REVIEW_DECISION_DELETED',
        }),
      );
      expect(result).toEqual({
        itemId: 'link-1',
        target: 'impact',
        currentDecision: 'needs_review',
        reviewNote: null,
        idempotent: false,
      });
    });

    it('undo on an already-undecided link is a no-op', async () => {
      const { useCase, traceabilityRepo, eventLog } = setup();
      const result = await useCase.execute({
        analysisId,
        itemId: 'link-1',
        target: 'impact',
        action: 'undo',
        actorId: 'user-1',
      });
      expect(traceabilityRepo.deleteReviewDecision).not.toHaveBeenCalled();
      expect(eventLog.recordEvent).not.toHaveBeenCalled();
      expect(result.idempotent).toBe(true);
    });
  });

  describe('insight items', () => {
    it('persists an accept status and the rationale as a review note', async () => {
      const { useCase, insightRepo, reviewNoteRepo, eventLog } = setup();

      const result = await useCase.execute({
        analysisId,
        itemId: 'insight-1',
        target: 'insight',
        action: 'reject',
        rationale: 'not relevant',
        actorId: 'user-1',
      });

      expect(insightRepo.updateReviewStatusIfCurrent).toHaveBeenCalledWith(
        expect.objectContaining({ insightId: 'insight-1', reviewStatus: 'REJECTED' }),
      );
      expect(reviewNoteRepo.upsert).toHaveBeenCalledWith({
        impactAnalysisId: analysisId,
        insightId: 'insight-1',
        body: 'not relevant',
      });
      expect(eventLog.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'INSIGHT_REVIEWED', actorUserId: 'user-1' }),
      );
      expect(result).toEqual({
        itemId: 'insight-1',
        target: 'insight',
        currentDecision: 'rejected',
        reviewNote: 'not relevant',
        idempotent: false,
      });
    });

    it('rejects needs_more_evidence for insight items', async () => {
      const { useCase } = setup();
      await expect(
        useCase.execute({
          analysisId,
          itemId: 'insight-1',
          target: 'insight',
          action: 'needs_more_evidence',
          actorId: 'user-1',
        }),
      ).rejects.toMatchObject({ code: 'REVIEW_NOT_ALLOWED' });
    });

    it('undo resets the status to NEEDS_REVIEW and clears the note', async () => {
      const { useCase, insightRepo, reviewNoteRepo } = setup({
        insight: {
          id: 'insight-1',
          reviewStatus: 'CONFIRMED',
          impactAnalysis: buildAnalysis(),
          reviewNote: { body: 'previously accepted' },
        },
      });

      const result = await useCase.execute({
        analysisId,
        itemId: 'insight-1',
        target: 'insight',
        action: 'undo',
        actorId: 'user-1',
      });

      expect(insightRepo.updateReviewStatusIfCurrent).toHaveBeenCalledWith(
        expect.objectContaining({ reviewStatus: 'NEEDS_REVIEW' }),
      );
      expect(reviewNoteRepo.clear).toHaveBeenCalledWith({
        impactAnalysisId: analysisId,
        insightId: 'insight-1',
      });
      expect(result.currentDecision).toBe('needs_review');
      expect(result.reviewNote).toBeNull();
    });

    it('is idempotent when status and note already match', async () => {
      const { useCase, insightRepo, reviewNoteRepo, eventLog } = setup({
        insight: {
          id: 'insight-1',
          reviewStatus: 'CONFIRMED',
          impactAnalysis: buildAnalysis(),
          reviewNote: { body: 'agreed' },
        },
      });

      const result = await useCase.execute({
        analysisId,
        itemId: 'insight-1',
        target: 'insight',
        action: 'accept',
        rationale: 'agreed',
        actorId: 'user-1',
      });

      expect(insightRepo.updateReviewStatusIfCurrent).not.toHaveBeenCalled();
      expect(reviewNoteRepo.upsert).not.toHaveBeenCalled();
      expect(eventLog.recordEvent).not.toHaveBeenCalled();
      expect(result.idempotent).toBe(true);
    });

    it('throws when the review became stale during the status update', async () => {
      const { useCase } = setup({ updateCount: 0 });
      await expect(
        useCase.execute({
          analysisId,
          itemId: 'insight-1',
          target: 'insight',
          action: 'accept',
          actorId: 'user-1',
        }),
      ).rejects.toMatchObject({ code: 'REVIEW_NOT_ALLOWED' });
    });
  });

  it('rejects an item that does not belong to the requested analysis', async () => {
    const { useCase } = setup({
      link: {
        id: 'link-1',
        impactAnalysis: buildAnalysis({ id: 'other-analysis' }),
        reviewDecision: null,
      },
    });
    await expect(
      useCase.execute({
        analysisId,
        itemId: 'link-1',
        target: 'impact',
        action: 'accept',
        actorId: 'user-1',
      }),
    ).rejects.toMatchObject({ code: 'REVIEW_NOT_ALLOWED' });
  });

  it('refuses to mutate a finalized analysis', async () => {
    const { useCase } = setup({
      link: {
        id: 'link-1',
        impactAnalysis: buildAnalysis({ status: 'COMPLETED' }),
        reviewDecision: null,
      },
    });
    await expect(
      useCase.execute({
        analysisId,
        itemId: 'link-1',
        target: 'impact',
        action: 'accept',
        actorId: 'user-1',
      }),
    ).rejects.toMatchObject({ code: 'REVIEW_NOT_ALLOWED' });
  });
});
