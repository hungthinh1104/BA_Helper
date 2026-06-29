import { Injectable } from '@nestjs/common';
import { AnalysisReviewDecisionValue } from '@prisma/client';;
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MergedMultiRepoReportReviewDecisionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    mergedReportId: string;
    decision: AnalysisReviewDecisionValue;
    note?: string;
    reviewedByUserId: string;
  }) {
    return this.prisma.mergedMultiRepoReportReviewDecision.create({
      data: {
        mergedReportId: data.mergedReportId,
        decision: data.decision,
        note: data.note || null,
        reviewedByUserId: data.reviewedByUserId,
      },
      include: {
        reviewedByUser: true,
        mergedReport: true,
      },
    });
  }

  async listByMergedReportId(mergedReportId: string) {
    return this.prisma.mergedMultiRepoReportReviewDecision.findMany({
      where: { mergedReportId },
      orderBy: { createdAt: 'desc' },
      include: {
        reviewedByUser: true,
        mergedReport: true,
      },
    });
  }

  async findLatestByMergedReportId(mergedReportId: string) {
    return this.prisma.mergedMultiRepoReportReviewDecision.findFirst({
      where: { mergedReportId },
      orderBy: { createdAt: 'desc' },
      include: {
        reviewedByUser: true,
        mergedReport: true,
      },
    });
  }
}
