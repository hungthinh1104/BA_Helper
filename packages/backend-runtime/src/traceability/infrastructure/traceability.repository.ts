import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';;
import { lockReviewableAnalysisWhileCurrent } from '../../impact-analysis/infrastructure/review-analysis-lock';
import { analysisEvidenceScopeWhere } from '../../evidence/infrastructure/analysis-evidence-scope';

export type TraceabilityLinkWithArtifactAndReviewDecision = Prisma.TraceabilityLinkGetPayload<{
  include: {
    artifact: true;
    evidenceLinks: {
      include: {
        evidence: {
          include: {
            artifact: true;
          };
        };
      };
    };
    reviewDecision: true;
  };
}>;

@Injectable()
export class TraceabilityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByAnalysis(impactAnalysisId: string): Promise<TraceabilityLinkWithArtifactAndReviewDecision[]> {
    const analysis = await this.prisma.impactAnalysis.findUnique({
      where: { id: impactAnalysisId },
      select: { snapshotId: true, requirementRevisionId: true },
    });
    if (!analysis) return [];

    return this.prisma.traceabilityLink.findMany({
      where: { impactAnalysisId, artifact: { snapshotId: analysis.snapshotId } },
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
        artifact: true,
        reviewDecision: true,
      },
    });
  }

  async findById(linkId: string, transaction?: Prisma.TransactionClient) {
    const client = transaction ?? this.prisma;
    return client.traceabilityLink.findUnique({
      where: { id: linkId },
      include: {
        impactAnalysis: {
          include: {
            snapshot: true,
            sourceTarget: true,
          },
        },
        reviewDecision: true,
      },
    });
  }

  async updateReviewStatus(params: {
    linkId: string;
    reviewStatus: 'CONFIRMED' | 'REJECTED';
  }, transaction?: Prisma.TransactionClient) {
    const update = async (tx: Prisma.TransactionClient) => {
      const link = await tx.traceabilityLink.findUnique({
        where: { id: params.linkId },
        select: { impactAnalysisId: true },
      });
      if (!link || !(await lockReviewableAnalysisWhileCurrent(tx, link.impactAnalysisId))) {
        return null;
      }
      return tx.traceabilityLink.update({
        where: { id: params.linkId },
        data: { reviewStatus: params.reviewStatus },
      });
    };
    return transaction ? update(transaction) : this.prisma.$transaction(update);
  }

  async updateReviewStatusIfCurrent(params: {
    linkId: string;
    reviewStatus: 'CONFIRMED' | 'REJECTED';
    expectedCommitSha: string;
    expectedTargetCommitSha: string;
    expectedResolvedRefType: 'BRANCH' | 'TAG' | 'COMMIT';
  }, transaction?: Prisma.TransactionClient) {
    const update = async (tx: Prisma.TransactionClient) => {
      const link = await tx.traceabilityLink.findUnique({
        where: { id: params.linkId },
        select: { impactAnalysisId: true },
      });
      if (!link || !(await lockReviewableAnalysisWhileCurrent(tx, link.impactAnalysisId))) {
        return { count: 0 };
      }
      return tx.traceabilityLink.updateMany({
        where: {
          id: params.linkId,
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
      artifactId: string;
      linkType: 'AFFECTED' | 'RELATED';
      linkBasis: 'EVIDENCED' | 'INFERRED';
      reviewStatus: 'NEEDS_REVIEW' | 'CONFIRMED' | 'REJECTED';
      confidence: number | null;
      retrievalMetadata?: any;
    }>,
  ) {
    if (items.length === 0) {
      return [];
    }

    await this.prisma.traceabilityLink.createMany({
      data: items.map((item) => ({
        impactAnalysisId: item.impactAnalysisId,
        artifactId: item.artifactId,
        linkType: item.linkType,
        linkBasis: item.linkBasis,
        reviewStatus: item.reviewStatus,
        confidence: item.confidence,
        retrievalMetadata: item.retrievalMetadata ?? undefined,
      })),
      skipDuplicates: true,
    });

    return this.prisma.traceabilityLink.findMany({
      where: {
        impactAnalysisId: items[0].impactAnalysisId,
        artifactId: { in: items.map((item) => item.artifactId) },
        linkType: { in: items.map((item) => item.linkType) },
      },
    });
  }

  async linkEvidence(params: { linkId: string; evidenceIds: string[] }) {
    if (params.evidenceIds.length === 0) {
      return [];
    }

    await this.prisma.traceabilityEvidence.createMany({
      data: params.evidenceIds.map((evidenceId) => ({
        traceabilityLinkId: params.linkId,
        evidenceId,
      })),
      skipDuplicates: true,
    });

    return this.prisma.traceabilityEvidence.findMany({
      where: { traceabilityLinkId: params.linkId },
    });
  }

  async linkEvidenceMany(items: Array<{ linkId: string; evidenceIds: string[] }>): Promise<void> {
    const data = items.flatMap(({ linkId, evidenceIds }) =>
      evidenceIds.map((evidenceId) => ({ traceabilityLinkId: linkId, evidenceId })),
    );
    if (data.length === 0) return;

    await this.prisma.traceabilityEvidence.createMany({ data, skipDuplicates: true });
  }

  async deleteReviewDecision(
    linkId: string,
    analysisId: string,
    transaction?: Prisma.TransactionClient,
  ) {
    const remove = async (tx: Prisma.TransactionClient) => {
      if (!(await lockReviewableAnalysisWhileCurrent(tx, analysisId))) {
        return null;
      }
      const deleted = await tx.traceabilityReviewDecision.delete({
        where: { traceabilityLinkId: linkId },
      });
      await tx.traceabilityLink.update({
        where: { id: linkId },
        data: { reviewStatus: 'NEEDS_REVIEW' },
      });
      return deleted;
    };
    return transaction ? remove(transaction) : this.prisma.$transaction(remove);
  }

  async upsertReviewDecision(params: {
    linkId: string;
    analysisId: string;
    decision: 'ACCEPTED' | 'REJECTED' | 'NEEDS_REVIEW' | 'NEEDS_MORE_EVIDENCE';
    note?: string | null;
    reviewedByUserId?: string | null;
  }, transaction?: Prisma.TransactionClient) {
    const reviewStatus = toTraceabilityReviewStatus(params.decision);
    const upsert = async (tx: Prisma.TransactionClient) => {
      if (!(await lockReviewableAnalysisWhileCurrent(tx, params.analysisId))) {
        return null;
      }
      await tx.traceabilityLink.update({
        where: { id: params.linkId },
        data: { reviewStatus },
      });

      return tx.traceabilityReviewDecision.upsert({
        where: { traceabilityLinkId: params.linkId },
        create: {
          traceabilityLinkId: params.linkId,
          analysisId: params.analysisId,
          decision: params.decision,
          note: params.note,
          reviewedByUserId: params.reviewedByUserId,
        },
        update: {
          decision: params.decision,
          note: params.note,
          reviewedByUserId: params.reviewedByUserId,
          reviewedAt: new Date(),
        },
      });
    };
    return transaction ? upsert(transaction) : this.prisma.$transaction(upsert);
  }
}

function toTraceabilityReviewStatus(
  decision: 'ACCEPTED' | 'REJECTED' | 'NEEDS_REVIEW' | 'NEEDS_MORE_EVIDENCE',
) {
  if (decision === 'ACCEPTED') return 'CONFIRMED';
  if (decision === 'REJECTED') return 'REJECTED';
  return 'NEEDS_REVIEW';
}
