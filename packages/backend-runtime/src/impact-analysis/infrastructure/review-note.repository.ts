import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

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

    return this.prisma.$transaction(async (tx) => {
      if (!(await this.lockAnalysisWhileReviewable(tx, data.impactAnalysisId))) {
        return null;
      }

      return tx.reviewNote.upsert({
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
    });
  }

  async findByAnalysisId(analysisId: string) {
    return this.prisma.reviewNote.findMany({
      where: { impactAnalysisId: analysisId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Removes any persisted rationale for a single review item. Used when a
   * reviewer undoes a decision or clears a previously recorded rationale.
   */
  async clear(data: {
    impactAnalysisId: string;
    insightId?: string;
    traceabilityLinkId?: string;
  }) {
    if (!data.insightId && !data.traceabilityLinkId) {
      throw new Error('Must provide either insightId or traceabilityLinkId');
    }
    return this.prisma.$transaction(async (tx) => {
      if (!(await this.lockAnalysisWhileReviewable(tx, data.impactAnalysisId))) {
        return null;
      }
      return tx.reviewNote.deleteMany({
        where: {
          impactAnalysisId: data.impactAnalysisId,
          insightId: data.insightId,
          traceabilityLinkId: data.traceabilityLinkId,
        },
      });
    });
  }

  private async lockAnalysisWhileReviewable(
    tx: Prisma.TransactionClient,
    analysisId: string,
  ): Promise<boolean> {
    const analyses = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT status
      FROM "ImpactAnalysis"
      WHERE id = ${analysisId}
      FOR UPDATE
    `;
    return analyses[0]?.status === 'WAITING_FOR_REVIEW';
  }
}
