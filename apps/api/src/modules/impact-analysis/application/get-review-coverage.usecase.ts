import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectPermissionService } from '../../project/application/project-permission.service';
import { RequestUser, ReviewCoverageResponse, ReviewCoverageGate, ReviewCoverageStatus } from '@ba-helper/contracts';
import { randomUUID } from 'crypto';

@Injectable()
export class GetReviewCoverageUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectPermissionService: ProjectPermissionService,
  ) {}

  async execute(actor: RequestUser, runId: string): Promise<ReviewCoverageResponse> {
    await this.projectPermissionService.assertCanReadMultiRepoRun(actor, runId);

    const run = await this.prisma.multiRepoAnalysisRun.findUnique({
      where: { id: runId },
      include: {
        analyses: {
          include: {
            sourceTarget: {
              include: { repository: true },
            },
            snapshot: {
              include: { repository: true },
            },
            reviewDecisions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            traceabilityLinks: {
              include: {
                artifact: true,
                evidenceLinks: true,
              },
            },
            insights: {
              include: {
                evidenceLinks: true,
              },
            },
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Multi-repo run not found');
    }

    const summary = {
      totalRepositories: 0,
      acceptedRepositories: 0,
      pendingRepositories: 0,
      rejectedRepositories: 0,
      impactedArtifacts: 0,
      artifactsWithEvidence: 0,
      uncoveredArtifacts: 0,
      risks: 0,
      risksWithQa: 0,
      risksWithoutQa: 0,
      qaScenarios: 0,
      blockingGates: 0,
      warningGates: 0,
    };

    const gates: ReviewCoverageGate[] = [];

    // Gate 1: Child review decisions
    let hasMissingOrRejectedDecision = false;
    const gate1AffectedAnalyses = new Set<string>();

    for (const analysis of run.analyses) {
      summary.totalRepositories++;
      const decision = analysis.reviewDecisions[0]?.decision;
      if (decision === 'ACCEPTED') {
        summary.acceptedRepositories++;
      } else if (decision === 'REJECTED' || decision === 'NEEDS_MORE_CLARIFICATION') {
        summary.rejectedRepositories++;
        hasMissingOrRejectedDecision = true;
        gate1AffectedAnalyses.add(analysis.id);
      } else {
        summary.pendingRepositories++;
        hasMissingOrRejectedDecision = true;
        gate1AffectedAnalyses.add(analysis.id);
      }
    }

    if (hasMissingOrRejectedDecision) {
      gates.push({
        gateId: randomUUID(),
        category: 'REVIEW_DECISION',
        status: 'FAIL',
        title: 'Pending or Rejected Analyses',
        description: 'One or more child analyses have not been accepted.',
        recommendedAction: 'Review and accept all child analyses before relying on the merged report.',
        affectedAnalysisIds: Array.from(gate1AffectedAnalyses),
        affectedArtifactIds: [],
        affectedInsightIds: [],
        affectedRepositoryIds: Array.from(gate1AffectedAnalyses).map(
          aId => run.analyses.find(a => a.id === aId)?.sourceTarget.repositoryId || ''
        ).filter(Boolean),
      });
      summary.blockingGates++;
    } else {
      gates.push({
        gateId: randomUUID(),
        category: 'REVIEW_DECISION',
        status: 'PASS',
        title: 'All Analyses Accepted',
        description: 'All child analyses have been accepted.',
        recommendedAction: 'None',
        affectedAnalysisIds: [],
        affectedArtifactIds: [],
        affectedInsightIds: [],
        affectedRepositoryIds: [],
      });
    }

    // Process artifacts and insights across all analyses
    let hasUncoveredArtifacts = false;
    const gate2AffectedArtifacts = new Set<string>();

    let hasUncoveredRisks = false;
    const gate3AffectedInsights = new Set<string>();

    let hasRepoWithRisksButNoQa = false;
    const gate4AffectedAnalyses = new Set<string>();

    let hasAcceptedWithZeroArtifacts = false;
    const gate5AffectedAnalyses = new Set<string>();

    for (const analysis of run.analyses) {
      const uniqueArtifacts = new Map<string, { hasEvidence: boolean }>();
      const riskInsights = new Map<string, Set<string>>(); // insightId -> Set of evidenceIds
      const qaInsights = new Map<string, Set<string>>(); // insightId -> Set of evidenceIds

      // 1. Artifacts
      for (const link of analysis.traceabilityLinks) {
        if (!uniqueArtifacts.has(link.artifactId)) {
          uniqueArtifacts.set(link.artifactId, { hasEvidence: false });
        }
        if (link.evidenceLinks.length > 0) {
          uniqueArtifacts.get(link.artifactId)!.hasEvidence = true;
        }
      }

      for (const [artifactId, info] of uniqueArtifacts.entries()) {
        summary.impactedArtifacts++;
        if (info.hasEvidence) {
          summary.artifactsWithEvidence++;
        } else {
          summary.uncoveredArtifacts++;
          hasUncoveredArtifacts = true;
          gate2AffectedArtifacts.add(artifactId);
        }
      }

      // 2. Insights
      let analysisRiskCount = 0;
      let analysisQaCount = 0;

      for (const insight of analysis.insights) {
        const isConflicting = insight.certainty === 'CONFLICTING';
        const isRisk = insight.insightType === 'UNKNOWN' || isConflicting;
        const isQa = insight.insightType === 'QA_SCENARIO';

        if (isRisk) {
          analysisRiskCount++;
          summary.risks++;
          const evidenceSet = new Set(insight.evidenceLinks.map(e => e.evidenceId));
          riskInsights.set(insight.id, evidenceSet);
        }

        if (isQa) {
          analysisQaCount++;
          summary.qaScenarios++;
          const evidenceSet = new Set(insight.evidenceLinks.map(e => e.evidenceId));
          qaInsights.set(insight.id, evidenceSet);
        }
      }

      for (const [riskId, riskEvidence] of riskInsights.entries()) {
        let isCovered = false;
        for (const [_, qaEvidence] of qaInsights.entries()) {
          for (const eid of riskEvidence) {
            if (qaEvidence.has(eid)) {
              isCovered = true;
              break;
            }
          }
          if (isCovered) break;
        }

        if (isCovered) {
          summary.risksWithQa++;
        } else {
          summary.risksWithoutQa++;
          hasUncoveredRisks = true;
          gate3AffectedInsights.add(riskId);
        }
      }

      // 3. Repo with risks but no QA
      if (analysisRiskCount > 0 && analysisQaCount === 0) {
        hasRepoWithRisksButNoQa = true;
        gate4AffectedAnalyses.add(analysis.id);
      }

      // 4. Accepted analysis with 0 impacted artifacts
      if (analysis.reviewDecisions[0]?.decision === 'ACCEPTED' && uniqueArtifacts.size === 0) {
        hasAcceptedWithZeroArtifacts = true;
        gate5AffectedAnalyses.add(analysis.id);
      }
    }

    if (hasUncoveredArtifacts) {
      gates.push({
        gateId: randomUUID(),
        category: 'EVIDENCE_COVERAGE',
        status: 'WARN',
        title: 'Impacted Artifacts Missing Evidence',
        description: 'Some impacted artifacts do not have any supporting evidence.',
        recommendedAction: 'Link evidence to the impacted artifacts or remove them if they are false positives.',
        affectedAnalysisIds: [],
        affectedArtifactIds: Array.from(gate2AffectedArtifacts),
        affectedInsightIds: [],
        affectedRepositoryIds: [],
      });
      summary.warningGates++;
    } else {
      gates.push({
        gateId: randomUUID(),
        category: 'EVIDENCE_COVERAGE',
        status: 'PASS',
        title: 'All Artifacts Have Evidence',
        description: 'All impacted artifacts have supporting evidence.',
        recommendedAction: 'None',
        affectedAnalysisIds: [],
        affectedArtifactIds: [],
        affectedInsightIds: [],
        affectedRepositoryIds: [],
      });
    }

    if (hasUncoveredRisks) {
      gates.push({
        gateId: randomUUID(),
        category: 'QA_COVERAGE',
        status: 'WARN',
        title: 'Risks Missing QA Scenarios',
        description: 'Some identified risks or conflicting insights are not covered by any QA scenario sharing the same evidence.',
        recommendedAction: 'Add QA scenarios addressing the identified risks.',
        affectedAnalysisIds: [],
        affectedArtifactIds: [],
        affectedInsightIds: Array.from(gate3AffectedInsights),
        affectedRepositoryIds: [],
      });
      summary.warningGates++;
    } else {
      gates.push({
        gateId: randomUUID(),
        category: 'QA_COVERAGE',
        status: 'PASS',
        title: 'All Risks Covered by QA',
        description: 'All identified risks are covered by QA scenarios.',
        recommendedAction: 'None',
        affectedAnalysisIds: [],
        affectedArtifactIds: [],
        affectedInsightIds: [],
        affectedRepositoryIds: [],
      });
    }

    if (hasRepoWithRisksButNoQa) {
      gates.push({
        gateId: randomUUID(),
        category: 'RISK_COVERAGE',
        status: 'WARN',
        title: 'Repositories with Risks but No QA',
        description: 'Some repositories have identified risks but zero QA scenarios defined.',
        recommendedAction: 'Review the risks in these repositories and add necessary QA scenarios.',
        affectedAnalysisIds: Array.from(gate4AffectedAnalyses),
        affectedArtifactIds: [],
        affectedInsightIds: [],
        affectedRepositoryIds: Array.from(gate4AffectedAnalyses).map(
          aId => run.analyses.find(a => a.id === aId)?.sourceTarget.repositoryId || ''
        ).filter(Boolean),
      });
      summary.warningGates++;
    } else {
      gates.push({
        gateId: randomUUID(),
        category: 'RISK_COVERAGE',
        status: 'PASS',
        title: 'No Repositories with Uncovered Risks',
        description: 'No repository has risks without QA scenarios.',
        recommendedAction: 'None',
        affectedAnalysisIds: [],
        affectedArtifactIds: [],
        affectedInsightIds: [],
        affectedRepositoryIds: [],
      });
    }

    if (hasAcceptedWithZeroArtifacts) {
      gates.push({
        gateId: randomUUID(),
        category: 'REPOSITORY_READINESS',
        status: 'WARN',
        title: 'Accepted Analysis with Zero Artifacts',
        description: 'An analysis was accepted despite having zero impacted artifacts.',
        recommendedAction: 'Verify if the repository truly has no impact or if the analysis was flawed.',
        affectedAnalysisIds: Array.from(gate5AffectedAnalyses),
        affectedArtifactIds: [],
        affectedInsightIds: [],
        affectedRepositoryIds: Array.from(gate5AffectedAnalyses).map(
          aId => run.analyses.find(a => a.id === aId)?.sourceTarget.repositoryId || ''
        ).filter(Boolean),
      });
      summary.warningGates++;
    } else {
      gates.push({
        gateId: randomUUID(),
        category: 'REPOSITORY_READINESS',
        status: 'PASS',
        title: 'All Accepted Analyses Have Impact',
        description: 'All accepted child analyses have at least one impacted artifact.',
        recommendedAction: 'None',
        affectedAnalysisIds: [],
        affectedArtifactIds: [],
        affectedInsightIds: [],
        affectedRepositoryIds: [],
      });
    }

    let overallStatus: ReviewCoverageStatus = 'PASS';
    if (summary.blockingGates > 0) {
      overallStatus = 'FAIL';
    } else if (summary.warningGates > 0) {
      overallStatus = 'WARN';
    }

    return {
      runId,
      status: overallStatus,
      summary,
      gates,
    };
  }
}
