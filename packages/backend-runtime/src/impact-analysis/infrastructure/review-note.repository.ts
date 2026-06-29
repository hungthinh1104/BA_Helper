import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../index';;
import { Prisma } from '@prisma/client';;

@Injectable()
export class ReviewNoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(data: {
    impactAnalysisId: string;
    insightId?: string;
    traceabilityLinkId?: string;
    body: string;
  }) {
    // Determine the unique constraint to use for upsert
    let where: Prisma.ReviewNoteWhereUniqueInput;
    if (data.insightId) {
      where = {
        impactAnalysisId_insightId: {
          impactAnalysisId: data.impactAnalysisId,
          insightId: data.insightId,
        },
      };
    } else if (data.traceabilityLinkId) {
      where = {
        impactAnalysisId_traceabilityLinkId: {
          impactAnalysisId: data.impactAnalysisId,
          traceabilityLinkId: data.traceabilityLinkId,
        },
      };
    } else {
      throw new Error('Must provide either insightId or traceabilityLinkId');
    }

    return this.prisma.reviewNote.upsert({
      where,
      create: {
        impactAnalysisId: data.impactAnalysisId,
        insightId: data.insightId,
        traceabilityLinkId: data.traceabilityLinkId,
        body: data.body,
      },
      update: {
        body: data.body,
      },
    });
  }

  async findByAnalysisId(analysisId: string) {
    return this.prisma.reviewNote.findMany({
      where: { impactAnalysisId: analysisId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
