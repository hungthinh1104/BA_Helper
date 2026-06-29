import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, ReviewClarificationStatus } from '@prisma/client';;

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
    return this.prisma.reviewClarificationRequest.create({
      data: {
        analysisId: data.analysisId,
        reviewDecisionId: data.reviewDecisionId,
        question: data.question,
        createdByUserId: data.createdByUserId,
        status: 'OPEN',
      },
      include: reviewClarificationInclude,
    });
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
    return this.prisma.reviewClarificationRequest.update({
      where: { id },
      data: {
        answer,
        answeredByUserId,
        answeredAt: new Date(),
        status: 'ANSWERED',
      },
      include: reviewClarificationInclude,
    });
  }
}
