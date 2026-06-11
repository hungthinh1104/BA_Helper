import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppError, AppErrorCode } from '../../../shared/app-error';
import { ImpactAnalysisDiffResponse, DiffArtifact, DiffInsight, DiagnosticItem } from '@ba-helper/contracts';
import { InsightType } from '@prisma/client';

@Injectable()
export class GetImpactDiffUseCase {
  constructor(private prisma: PrismaService) {}

  async execute(analysisId: string): Promise<ImpactAnalysisDiffResponse> {
    const result = await this.computeForAnalysis(analysisId);
    if (!result.computable) {
      if (result.reason === 'CURRENT_ANALYSIS_MISSING') {
        throw new AppError('ANALYSIS_NOT_FOUND', 'Analysis not found.');
      }
      if (result.reason === 'BASELINE_ANALYSIS_MISSING') {
        throw new AppError('NO_BASELINE_ANALYSIS', 'This analysis does not have a baseline to diff against.');
      }
      if (result.reason === 'CURRENT_NOT_COMPLETED') {
        throw new AppError('DIFF_NOT_READY', 'Analysis diff is not ready yet.');
      }
      throw new AppError(result.reason!, 'Analysis diff is not ready or computable.');
    }
    return result.diff!;
  }

  async computeForAnalysis(analysisId: string): Promise<{ computable: boolean; reason?: AppErrorCode; diff?: ImpactAnalysisDiffResponse }> {
    const currentAnalysis = await this.prisma.impactAnalysis.findUnique({
      where: { id: analysisId },
      include: {
        snapshot: true,
      },
    });

    if (!currentAnalysis) {
      return { computable: false, reason: 'CURRENT_ANALYSIS_MISSING' };
    }

    if (!currentAnalysis.derivedFromAnalysisId) {
      return { computable: false, reason: 'BASELINE_ANALYSIS_MISSING' };
    }

    if (currentAnalysis.status !== 'WAITING_FOR_REVIEW' && currentAnalysis.status !== 'COMPLETED') {
      return { computable: false, reason: 'CURRENT_NOT_COMPLETED' };
    }

    const baseAnalysis = await this.prisma.impactAnalysis.findUnique({
      where: { id: currentAnalysis.derivedFromAnalysisId },
      include: {
        snapshot: true,
      },
    });

    if (!baseAnalysis) {
      return { computable: false, reason: 'BASELINE_ANALYSIS_MISSING' };
    }

    if (baseAnalysis.status !== 'COMPLETED') {
      return { computable: false, reason: 'BASELINE_NOT_COMPLETED' };
    }

    if (!currentAnalysis.snapshot || !baseAnalysis.snapshot) {
      return { computable: false, reason: 'SNAPSHOT_MISSING' };
    }

    // 1. Comparison Context
    const requirementChanged = currentAnalysis.requirementRevisionId !== baseAnalysis.requirementRevisionId;
    const snapshotChanged = currentAnalysis.snapshotId !== baseAnalysis.snapshotId;

    const comparisonContext = {
      requirementChanged,
      snapshotChanged,
      baseRequirementRevisionId: baseAnalysis.requirementRevisionId,
      currentRequirementRevisionId: currentAnalysis.requirementRevisionId,
      baseSnapshotId: baseAnalysis.snapshotId,
      currentSnapshotId: currentAnalysis.snapshotId,
      baseCommitSha: baseAnalysis.snapshot.commitSha,
      currentCommitSha: currentAnalysis.snapshot.commitSha,
      sourceClarificationId: currentAnalysis.sourceClarificationId ?? undefined,
    };

    // 2. Diff TraceabilityLinks (Impacted Artifacts)
    const baseLinks = await this.prisma.traceabilityLink.findMany({
      where: {
        impactAnalysisId: baseAnalysis.id,
        linkType: 'AFFECTED',
        reviewStatus: { not: 'REJECTED' },
      },
      include: { artifact: true },
    });

    const currentLinks = await this.prisma.traceabilityLink.findMany({
      where: {
        impactAnalysisId: currentAnalysis.id,
        linkType: 'AFFECTED',
        reviewStatus: { not: 'REJECTED' },
      },
      include: { artifact: true },
    });

    const baseArtifactsMap = new Map<string, typeof baseLinks[0]>();
    for (const link of baseLinks) {
      baseArtifactsMap.set(link.artifact.artifactKey, link);
    }

    const currentArtifactsMap = new Map<string, typeof currentLinks[0]>();
    for (const link of currentLinks) {
      currentArtifactsMap.set(link.artifact.artifactKey, link);
    }

    const addedArtifacts: DiffArtifact[] = [];
    const removedArtifacts: DiffArtifact[] = [];
    const unchangedArtifacts: DiffArtifact[] = [];

    for (const [key, currentLink] of currentArtifactsMap) {
      const mapped: DiffArtifact = {
        artifactKey: key,
        name: currentLink.artifact.name,
        artifactType: currentLink.artifact.artifactType,
        filePath: currentLink.artifact.filePath,
        reviewStatus: currentLink.reviewStatus,
      };

      if (baseArtifactsMap.has(key)) {
        unchangedArtifacts.push(mapped);
      } else {
        addedArtifacts.push(mapped);
      }
    }

    for (const [key, baseLink] of baseArtifactsMap) {
      if (!currentArtifactsMap.has(key)) {
        removedArtifacts.push({
          artifactKey: key,
          name: baseLink.artifact.name,
          artifactType: baseLink.artifact.artifactType,
          filePath: baseLink.artifact.filePath,
          reviewStatus: baseLink.reviewStatus, // using the old status
        });
      }
    }

    // 3. Diff Insights (UNKNOWN, QA_SCENARIO)
    const baseInsights = await this.prisma.baInsight.findMany({
      where: {
        impactAnalysisId: baseAnalysis.id,
        insightType: { in: ['UNKNOWN', 'QA_SCENARIO'] },
      },
    });

    const currentInsights = await this.prisma.baInsight.findMany({
      where: {
        impactAnalysisId: currentAnalysis.id,
        insightType: { in: ['UNKNOWN', 'QA_SCENARIO'] },
      },
    });

    const buildInsightDiffKey = (type: InsightType, insightKey: string, title: string, statement: string) => {
      // Rule 1: insightKey if present (in our model, insightKey is generated, it should be stable if deterministically computed)
      // Actually, if we use UUID for insightKey sometimes, we might need to fallback.
      // We will create a normalized statement hash.
      const normalizedTitle = title.trim().toLowerCase();
      const normalizedStatement = statement.trim().toLowerCase();
      
      if (type === 'UNKNOWN') {
        return `UNKNOWN::${normalizedStatement}`;
      } else if (type === 'QA_SCENARIO') {
        return `QA_SCENARIO::${insightKey || normalizedTitle}`;
      } else {
        return `${type}::${insightKey || normalizedTitle + '::' + normalizedStatement}`;
      }
    };

    const baseInsightsMap = new Map<string, typeof baseInsights[0]>();
    for (const insight of baseInsights) {
      const key = buildInsightDiffKey(insight.insightType, insight.insightKey, insight.title, insight.description);
      baseInsightsMap.set(key, insight);
    }

    const currentInsightsMap = new Map<string, typeof currentInsights[0]>();
    for (const insight of currentInsights) {
      const key = buildInsightDiffKey(insight.insightType, insight.insightKey, insight.title, insight.description);
      currentInsightsMap.set(key, insight);
    }

    const resolvedUnknowns: DiffInsight[] = [];
    const removedUnknowns: DiffInsight[] = [];
    const newUnknowns: DiffInsight[] = [];
    const addedQaScenarios: DiffInsight[] = [];

    // Check for resolved / removed unknowns
    for (const [key, baseInsight] of baseInsightsMap) {
      if (!currentInsightsMap.has(key)) {
        const mapped: DiffInsight = {
          insightKey: baseInsight.insightKey,
          category: baseInsight.insightType,
          statement: baseInsight.description,
          reviewStatus: baseInsight.reviewStatus,
        };

        if (baseInsight.insightType === 'UNKNOWN') {
          // Check if this unknown has a matching clarification lineage
          let isResolved = false;
          if (currentAnalysis.sourceClarificationId) {
            const clarification = await this.prisma.clarificationItem.findUnique({
              where: { id: currentAnalysis.sourceClarificationId },
            });
            if (clarification && clarification.sourceInsightId === baseInsight.id) {
              isResolved = true;
            }
          }
          
          if (isResolved) {
            resolvedUnknowns.push(mapped);
          } else {
            removedUnknowns.push(mapped);
          }
        }
      }
    }

    // Check for new unknowns and added QA scenarios
    for (const [key, currentInsight] of currentInsightsMap) {
      if (!baseInsightsMap.has(key)) {
        const mapped: DiffInsight = {
          insightKey: currentInsight.insightKey,
          category: currentInsight.insightType,
          statement: currentInsight.description,
          reviewStatus: currentInsight.reviewStatus,
        };

        if (currentInsight.insightType === 'UNKNOWN') {
          newUnknowns.push(mapped);
        } else if (currentInsight.insightType === 'QA_SCENARIO') {
          addedQaScenarios.push(mapped);
        }
      }
    }

    const diagnostics: DiagnosticItem[] = [];
    if (snapshotChanged) {
      diagnostics.push({
        code: 'SNAPSHOT_CHANGED',
        severity: 'WARN',
        message: 'The base analysis and current analysis use different repository snapshots. Some differences may come from code changes.',
      });
    }

    return {
      computable: true,
      diff: {
        baseAnalysisId: baseAnalysis.id,
        currentAnalysisId: currentAnalysis.id,
        comparisonContext,
        summary: {
          addedImpacts: addedArtifacts.length,
          removedImpacts: removedArtifacts.length,
          unchangedImpacts: unchangedArtifacts.length,
          resolvedUnknowns: resolvedUnknowns.length,
          removedUnknowns: removedUnknowns.length,
          newUnknowns: newUnknowns.length,
          addedQaScenarios: addedQaScenarios.length,
        },
        addedArtifacts,
        removedArtifacts,
        unchangedArtifacts,
        resolvedUnknowns,
        removedUnknowns,
        newUnknowns,
        addedQaScenarios,
        diagnostics,
      },
    };
  }
}
