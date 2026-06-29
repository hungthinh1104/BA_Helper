import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../index';;
import { AnalysisReviewDecisionValue } from '@prisma/client';;

@Injectable()
export class ReviewDecisionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    analysisId: string;
    decision: AnalysisReviewDecisionValue;
    note?: string;
    reviewedByUserId: string;
  }) {
    return this.prisma.analysisReviewDecision.create({
      data: {
        analysisId: data.analysisId,
        decision: data.decision,
        note: data.note || null,
        reviewedByUserId: data.reviewedByUserId,
      },
      include: { reviewedByUser: true },
    });
  }

  async findById(id: string) {
    return this.prisma.analysisReviewDecision.findUnique({
      where: { id },
      include: { reviewedByUser: true },
    });
  }

  async listByAnalysisId(analysisId: string) {
    return this.prisma.analysisReviewDecision.findMany({
      where: { analysisId },
      orderBy: { createdAt: 'desc' },
      include: { reviewedByUser: true },
    });
  }

  async findLatestByAnalysisId(analysisId: string) {
    return this.prisma.analysisReviewDecision.findFirst({
      where: { analysisId },
      orderBy: { createdAt: 'desc' },
      include: { reviewedByUser: true },
    });
  }
}
