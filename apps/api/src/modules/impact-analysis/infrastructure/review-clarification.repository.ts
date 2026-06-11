import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReviewClarificationStatus } from '@prisma/client';

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
    });
  }

  async findById(id: string) {
    return this.prisma.reviewClarificationRequest.findUnique({
      where: { id },
      include: {
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
      include: {
        derivedAnalyses: {
          select: { id: true },
        },
      },
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
    });
  }
}
