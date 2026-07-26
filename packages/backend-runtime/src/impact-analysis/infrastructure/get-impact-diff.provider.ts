import { Injectable } from '@nestjs/common';
import {
  GetImpactDiff,
  type ImpactDiffRepositoryPort,
  type ImpactDiffAnalysisRecord,
  type ImpactDiffArtifactLink,
  type ImpactDiffInsightRecord,
} from '@ba-helper/application';
import type { DiffArtifact, DiffInsight } from '@ba-helper/contracts';
import { PrismaService } from '../../prisma/prisma.service';

/** Prisma-backed data adapter for the pure {@link GetImpactDiff} use case. */
class PrismaImpactDiffRepository implements ImpactDiffRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalysis(analysisId: string): Promise<ImpactDiffAnalysisRecord | null> {
    const analysis = await this.prisma.impactAnalysis.findUnique({
      where: { id: analysisId },
      include: { snapshot: true },
    });
    if (!analysis) return null;
    return {
      id: analysis.id,
      derivedFromAnalysisId: analysis.derivedFromAnalysisId,
      status: analysis.status,
      requirementRevisionId: analysis.requirementRevisionId,
      snapshotId: analysis.snapshotId,
      sourceClarificationId: analysis.sourceClarificationId,
      reviewClarificationRequestId: analysis.reviewClarificationRequestId,
      snapshot: analysis.snapshot ? { commitSha: analysis.snapshot.commitSha } : null,
    };
  }

  async getAffectedArtifactLinks(analysisId: string): Promise<ImpactDiffArtifactLink[]> {
    const links = await this.prisma.traceabilityLink.findMany({
      where: {
        impactAnalysisId: analysisId,
        linkType: 'AFFECTED',
        reviewStatus: { not: 'REJECTED' },
      },
      include: { artifact: true },
    });
    return links.map((link) => ({
      reviewStatus: link.reviewStatus as DiffArtifact['reviewStatus'],
      artifact: {
        artifactKey: link.artifact.artifactKey,
        name: link.artifact.name,
        artifactType: link.artifact.artifactType,
        universalKind: link.artifact.universalKind as DiffArtifact['universalKind'],
        filePath: link.artifact.filePath,
      },
    }));
  }

  async getDiffInsights(analysisId: string): Promise<ImpactDiffInsightRecord[]> {
    const insights = await this.prisma.baInsight.findMany({
      where: {
        impactAnalysisId: analysisId,
        insightType: { in: ['UNKNOWN', 'QA_SCENARIO'] },
      },
    });
    return insights.map((insight) => ({
      id: insight.id,
      insightKey: insight.insightKey,
      insightType: insight.insightType as DiffInsight['category'],
      title: insight.title,
      description: insight.description,
      reviewStatus: insight.reviewStatus as DiffInsight['reviewStatus'],
    }));
  }

  async getClarificationSourceInsightId(clarificationId: string): Promise<string | null> {
    const clarification = await this.prisma.clarificationItem.findUnique({
      where: { id: clarificationId },
    });
    return clarification?.sourceInsightId ?? null;
  }
}

/**
 * Composition wrapper: wires the Prisma adapter into the pure
 * {@link GetImpactDiff} use case (which lives in `@ba-helper/application`).
 * Keeps the historical `GetImpactDiffUseCase` injection token and method
 * surface so DI wiring and call sites are unchanged (ADR-0010).
 */
@Injectable()
export class GetImpactDiffUseCase {
  private readonly core: GetImpactDiff;

  constructor(prisma: PrismaService) {
    this.core = new GetImpactDiff(new PrismaImpactDiffRepository(prisma));
  }

  execute(analysisId: string) {
    return this.core.execute(analysisId);
  }

  computeForAnalysis(analysisId: string) {
    return this.core.computeForAnalysis(analysisId);
  }
}
