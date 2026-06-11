import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TraceabilityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByAnalysis(impactAnalysisId: string) {
    return this.prisma.traceabilityLink.findMany({
      where: { impactAnalysisId },
      include: {
        evidenceLinks: { include: { evidence: true } },
        artifact: true,
      },
    });
  }

  async findById(linkId: string) {
    return this.prisma.traceabilityLink.findUnique({
      where: { id: linkId },
      include: {
        impactAnalysis: {
          include: {
            snapshot: true,
            sourceTarget: true,
          },
        },
      },
    });
  }

  async updateReviewStatus(params: {
    linkId: string;
    reviewStatus: 'CONFIRMED' | 'REJECTED';
  }) {
    return this.prisma.traceabilityLink.update({
      where: { id: params.linkId },
      data: { reviewStatus: params.reviewStatus },
    });
  }

  async updateReviewStatusIfCurrent(params: {
    linkId: string;
    reviewStatus: 'CONFIRMED' | 'REJECTED';
    expectedCommitSha: string;
    expectedTargetCommitSha: string;
    expectedResolvedRefType: 'BRANCH' | 'TAG' | 'COMMIT';
  }) {
    return this.prisma.traceabilityLink.updateMany({
      where: {
        id: params.linkId,
        impactAnalysis: {
          snapshot: {
            commitSha: params.expectedCommitSha,
          },
          sourceTarget: {
            resolvedRefType: params.expectedResolvedRefType,
            latestObservedCommitSha: params.expectedTargetCommitSha,
          },
        },
      },
      data: { reviewStatus: params.reviewStatus },
    });
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
}
