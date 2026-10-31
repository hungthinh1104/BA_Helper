import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, ReviewClarificationStatus } from '@prisma/client';
import { lockReviewAnalysisForMutation } from './review-analysis-lock';

const reviewClarificationInclude = {
  createdByUser: true,
  answeredByUser: true,
  derivedAnalyses: {
    select: { id: true },
  },
} satisfies Prisma.ReviewClarificationRequestInclude;

@Injectable()
export class ReviewClarificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    analysisId: string;
    reviewDecisionId: string;
    question: string;
    createdByUserId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      if (!(await lockReviewAnalysisForMutation(tx, data.analysisId))) return null;
      return tx.reviewClarificationRequest.create({
        data: {
          analysisId: data.analysisId,
          reviewDecisionId: data.reviewDecisionId,
          question: data.question,
          createdByUserId: data.createdByUserId,
          status: 'OPEN',
        },
        include: reviewClarificationInclude,
      });
    }, { maxWait: 25_000, timeout: 30_000 });
  }

  async findById(id: string) {
    return this.prisma.reviewClarificationRequest.findUnique({
      where: { id },
      include: {
        ...reviewClarificationInclude,
        reviewDecision: true,
      },
    });
  }

  async findOpenByReviewDecisionId(reviewDecisionId: string) {
    return this.prisma.reviewClarificationRequest.findFirst({
      where: {
        reviewDecisionId,
        status: 'OPEN',
      },
    });
  }

  async listByAnalysisId(analysisId: string) {
    return this.prisma.reviewClarificationRequest.findMany({
      where: { analysisId },
      orderBy: { createdAt: 'desc' },
      include: reviewClarificationInclude,
    });
  }

  async answer(id: string, answer: string, answeredByUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.reviewClarificationRequest.findUnique({
        where: { id },
        select: { analysisId: true },
      });
      if (!existing || !(await lockReviewAnalysisForMutation(tx, existing.analysisId))) return null;

      const updated = await tx.reviewClarificationRequest.updateMany({
        where: { id, status: ReviewClarificationStatus.OPEN },
        data: {
          answer,
          answeredByUserId,
          answeredAt: new Date(),
          status: ReviewClarificationStatus.ANSWERED,
        },
      });
      const clarification = await tx.reviewClarificationRequest.findUnique({
        where: { id },
        include: reviewClarificationInclude,
      });
      return clarification ? { clarification, changed: updated.count === 1 } : null;
    }, { maxWait: 25_000, timeout: 30_000 });
  }
}
