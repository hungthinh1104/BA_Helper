import type { EventLogService, PrismaService, TraceabilityRepository } from '@ba-helper/backend-runtime';
import { DeleteTraceabilityReviewDecisionUseCase } from './delete-traceability-review-decision.usecase';
import { UpdateTraceabilityReviewDecisionUseCase } from './update-traceability-review-decision.usecase';

const analysis = {
  id: 'analysis-1',
  status: 'WAITING_FOR_REVIEW',
  snapshot: { commitSha: 'sha-1' },
  sourceTarget: { resolvedRefType: 'BRANCH', latestObservedCommitSha: 'sha-1' },
};

function setup() {
  const transaction = { id: 'review-transaction' };
  const prisma = {
    $transaction: jest.fn(async (work: (tx: typeof transaction) => unknown) => work(transaction)),
  };
  const repository = {
    findById: jest.fn().mockResolvedValue({ id: 'link-1', impactAnalysis: analysis }),
    upsertReviewDecision: jest.fn().mockResolvedValue({ id: 'decision-1', decision: 'ACCEPTED' }),
    deleteReviewDecision: jest.fn().mockResolvedValue({ id: 'decision-1' }),
  };
  const eventLog = { recordEvent: jest.fn().mockResolvedValue(undefined) };
  return { transaction, prisma, repository, eventLog };
}

describe('traceability review audit transaction', () => {
  it('commits a legacy decision and its audit event through the same transaction', async () => {
    const { transaction, prisma, repository, eventLog } = setup();
    const useCase = new UpdateTraceabilityReviewDecisionUseCase(
      repository as unknown as TraceabilityRepository,
      eventLog as unknown as EventLogService,
      prisma as unknown as PrismaService,
    );

    await useCase.execute({ linkId: 'link-1', decision: 'ACCEPTED', reviewedByUserId: 'user-1' });

    expect(repository.upsertReviewDecision).toHaveBeenCalledWith(
      expect.objectContaining({ linkId: 'link-1', analysisId: 'analysis-1' }),
      transaction,
    );
    expect(eventLog.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'TRACEABILITY_REVIEW_DECISION_UPDATED' }),
      transaction,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('commits a legacy undo and its audit event through the same transaction', async () => {
    const { transaction, prisma, repository, eventLog } = setup();
    const useCase = new DeleteTraceabilityReviewDecisionUseCase(
      repository as unknown as TraceabilityRepository,
      eventLog as unknown as EventLogService,
      prisma as unknown as PrismaService,
    );

    await useCase.execute({ linkId: 'link-1' });

    expect(repository.deleteReviewDecision).toHaveBeenCalledWith(
      'link-1',
      'analysis-1',
      transaction,
    );
    expect(eventLog.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'TRACEABILITY_REVIEW_DECISION_DELETED' }),
      transaction,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
