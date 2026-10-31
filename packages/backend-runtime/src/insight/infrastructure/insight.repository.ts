import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import { lockReviewableAnalysisWhileCurrent } from '../../impact-analysis/infrastructure/review-analysis-lock';
import {
  analysisEvidenceScopeWhere,
  assertEvidenceLinksScopedToAnalyses,
} from '../../evidence/infrastructure/analysis-evidence-scope';

@Injectable()
export class InsightRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByAnalysis(impactAnalysisId: string) {
    const analysis = await this.prisma.impactAnalysis.findUnique({
      where: { id: impactAnalysisId },
      select: { snapshotId: true, requirementRevisionId: true },
    });
    if (!analysis) return [];

    const insights = await this.prisma.baInsight.findMany({
      where: { impactAnalysisId },
      include: {
        evidenceLinks: {
          where: { evidence: analysisEvidenceScopeWhere(analysis.snapshotId, analysis.requirementRevisionId) },
          include: {
            evidence: {
              include: {
                artifact: true,
              },
            },
          },
        },
      },
    });

    const traceabilityLinks = await this.prisma.traceabilityLink.findMany({
      where: { impactAnalysisId },
      select: { artifactId: true, retrievalMetadata: true },
    });
    
    const retrievalMap = new Map(
      traceabilityLinks.map((link) => [link.artifactId, link.retrievalMetadata])
    );

    return insights.map((insight) => ({
      ...insight,
      evidenceLinks: insight.evidenceLinks.map((link) => {
        const metadata = link.evidence.artifactId
          ? retrievalMap.get(link.evidence.artifactId)
          : undefined;
        return {
          ...link,
          evidence: {
            ...link.evidence,
            retrievalMetadata: metadata ?? undefined,
          },
        };
      }),
    }));
  }

  async findById(insightId: string, transaction?: Prisma.TransactionClient) {
    const client = transaction ?? this.prisma;
    return client.baInsight.findUnique({
      where: { id: insightId },
      include: {
        impactAnalysis: {
          include: {
            snapshot: true,
            sourceTarget: true,
          },
        },
        reviewNote: true,
      },
    });
  }

  async updateReviewStatus(params: {
    insightId: string;
    reviewStatus: 'CONFIRMED' | 'REJECTED';
  }, transaction?: Prisma.TransactionClient) {
    const update = async (tx: Prisma.TransactionClient) => {
      const insight = await tx.baInsight.findUnique({
        where: { id: params.insightId },
        select: { impactAnalysisId: true },
      });
      if (!insight || !(await lockReviewableAnalysisWhileCurrent(tx, insight.impactAnalysisId))) {
        return null;
      }
      return tx.baInsight.update({
        where: { id: params.insightId },
        data: { reviewStatus: params.reviewStatus },
      });
    };
    return transaction ? update(transaction) : this.prisma.$transaction(update);
  }

  async updateReviewStatusIfCurrent(params: {
    insightId: string;
    reviewStatus: 'CONFIRMED' | 'REJECTED' | 'NEEDS_REVIEW';
    expectedCommitSha: string;
    expectedTargetCommitSha: string;
    expectedResolvedRefType: 'BRANCH' | 'TAG' | 'COMMIT';
  }, transaction?: Prisma.TransactionClient) {
    const update = async (tx: Prisma.TransactionClient) => {
      const insight = await tx.baInsight.findUnique({
        where: { id: params.insightId },
        select: { impactAnalysisId: true },
      });
      if (!insight || !(await lockReviewableAnalysisWhileCurrent(tx, insight.impactAnalysisId))) {
        return { count: 0 };
      }
      return tx.baInsight.updateMany({
        where: {
          id: params.insightId,
          impactAnalysis: {
            status: 'WAITING_FOR_REVIEW',
            snapshot: {
              commitSha: params.expectedCommitSha,
            },
            sourceTarget: {
              resolvedRefType: params.expectedResolvedRefType,
              ...(params.expectedResolvedRefType === 'COMMIT'
                ? {}
                : { latestObservedCommitSha: params.expectedTargetCommitSha }),
            },
          },
        },
        data: { reviewStatus: params.reviewStatus },
      });
    };
    return transaction ? update(transaction) : this.prisma.$transaction(update);
  }

  async upsertMany(
    items: Array<{
      impactAnalysisId: string;
      insightKey: string;
      insightType: 'CLAIM' | 'UNKNOWN' | 'QUESTION' | 'ACCEPTANCE_CRITERIA' | 'QA_SCENARIO';
      certainty: 'EVIDENCED' | 'INFERRED' | 'UNKNOWN' | 'CONFLICTING';
      reviewStatus: 'NEEDS_REVIEW' | 'CONFIRMED' | 'REJECTED';
      confidence: number | null;
      title: string;
      description: string;
      reasoning?: string | null;
      metadata?: Record<string, unknown> | null;
    }>,
  ) {
    if (items.length === 0) {
      return [];
    }

    await this.prisma.baInsight.createMany({
      data: items.map((item) => ({
        impactAnalysisId: item.impactAnalysisId,
        insightKey: item.insightKey,
        insightType: item.insightType,
        certainty: item.certainty,
        reviewStatus: item.reviewStatus,
        confidence: item.confidence,
        title: item.title,
        description: item.description,
        reasoning: item.reasoning ?? null,
        metadata: item.metadata ? (item.metadata as any) : undefined,
      })),
      skipDuplicates: true,
    });

    return this.prisma.baInsight.findMany({
      where: {
        impactAnalysisId: items[0].impactAnalysisId,
        insightKey: { in: items.map((item) => item.insightKey) },
      },
    });
  }

  async linkEvidence(params: { insightId: string; evidenceIds: string[] }) {
    if (params.evidenceIds.length === 0) {
      return [];
    }

    await this.linkEvidenceMany([{ insightId: params.insightId, evidenceIds: params.evidenceIds }]);

    return this.prisma.insightEvidence.findMany({
      where: { insightId: params.insightId },
    });
  }

  async linkEvidenceMany(items: Array<{ insightId: string; evidenceIds: string[] }>): Promise<void> {
    const data = items.flatMap(({ insightId, evidenceIds }) =>
      evidenceIds.map((evidenceId) => ({ insightId, evidenceId })),
    );
    if (data.length === 0) return;

    await this.prisma.$transaction(async (transaction) => {
      const insights = await transaction.baInsight.findMany({
        where: { id: { in: [...new Set(data.map((link) => link.insightId))] } },
        select: {
          id: true,
          impactAnalysis: { select: { snapshotId: true, requirementRevisionId: true } },
        },
      });
      const scopesByInsightId = new Map(insights.map((insight) => [
        insight.id,
        insight.impactAnalysis,
      ]));
      await assertEvidenceLinksScopedToAnalyses(
        transaction,
        scopesByInsightId,
        data.map(({ insightId, evidenceId }) => ({ ownerId: insightId, evidenceId })),
      );
      await transaction.insightEvidence.createMany({ data, skipDuplicates: true });
    });
  }
}
