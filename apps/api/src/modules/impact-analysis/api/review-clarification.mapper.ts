import { Prisma } from '@prisma/client';
import { ReviewClarificationRequest } from '@ba-helper/contracts';

type ReviewClarificationEntity = Prisma.ReviewClarificationRequestGetPayload<{
  include: {
    createdByUser: true;
    answeredByUser: true;
    derivedAnalyses: {
      select: { id: true };
    };
  };
}>;

const mapUserLabel = (user: { name: string | null; email: string } | null) => {
  if (!user) {
    return null;
  }

  return user.name ?? user.email;
};

export const mapReviewClarificationRequest = (
  entity: ReviewClarificationEntity,
): ReviewClarificationRequest => ({
  id: entity.id,
  analysisId: entity.analysisId,
  reviewDecisionId: entity.reviewDecisionId,
  question: entity.question,
  answer: entity.answer,
  status: entity.status,
  createdBy: mapUserLabel(entity.createdByUser) ?? entity.createdByUserId,
  answeredBy: mapUserLabel(entity.answeredByUser),
  createdAt: entity.createdAt.toISOString(),
  answeredAt: entity.answeredAt?.toISOString() ?? null,
  cancelledAt: entity.cancelledAt?.toISOString() ?? null,
  derivedAnalyses: entity.derivedAnalyses.map((analysis) => ({ id: analysis.id })),
});
