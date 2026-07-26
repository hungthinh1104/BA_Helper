import { Injectable, NotFoundException } from '@nestjs/common';
import { MultiRepoImpactMatrixResponse, MultiRepoImpactMatrixRow } from '@ba-helper/contracts';
import {
  deriveChildBlockingReason,
  isChildAnalysisStale,
} from './multi-repo-merged-report-state';
import { PrismaService, MultiRepoAnalysisRunRepository } from "@ba-helper/backend-runtime";

@Injectable()
export class BuildMultiRepoImpactMatrixReadModel {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runRepo: MultiRepoAnalysisRunRepository,
  ) {}

  async execute(runId: string): Promise<MultiRepoImpactMatrixResponse> {
    const run = await this.runRepo.findById(runId);
    if (!run) {
      throw new NotFoundException(`Multi-repo analysis run ${runId} not found`);
    }

    const analyses = await this.prisma.impactAnalysis.findMany({
      where: { multiRepoRunId: runId },
      include: {
        snapshot: {
          include: { profile: true, repository: true },
        },
        traceabilityLinks: {
          include: { artifact: true },
          where: { linkType: 'AFFECTED' },
        },
        insights: true,
        reviewDecisions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        sourceTarget: true,
      },
    });

    const rows: MultiRepoImpactMatrixRow[] = [];
    const domainsSet = new Set<string>();
    let totalArtifacts = 0;
    let totalRisks = 0;
    let totalQaScenarios = 0;
    let acceptedRepos = 0;
    let blockedRepos = 0;

    for (const analysis of analyses) {
      const profile = analysis.snapshot.profile;
      const domain = profile?.domain ?? 'UNKNOWN';
      const language = profile?.language ?? 'UNKNOWN';
      const framework = profile?.framework ?? 'UNKNOWN';

      if (domain !== 'UNKNOWN') {
        domainsSet.add(domain);
      }

      const latestDecision = analysis.reviewDecisions[0]?.decision ?? null;

      // Unique artifacts by kind
      const uniqueArtifacts = new Map<string, string>(); // artifactId -> universalKind
      for (const link of analysis.traceabilityLinks) {
        uniqueArtifacts.set(link.artifactId, link.artifact.universalKind);
      }

      const artifactCounts = {
        API_ENDPOINT: 0,
        DOMAIN_SERVICE: 0,
        DATA_MODEL: 0,
        TEST_CASE: 0,
        UNKNOWN: 0,
      };

      for (const kind of uniqueArtifacts.values()) {
        if (kind in artifactCounts) {
          artifactCounts[kind as keyof typeof artifactCounts]++;
          totalArtifacts++;
        } else {
          artifactCounts.UNKNOWN++;
          totalArtifacts++;
        }
      }

      const evidenceCount = analysis.traceabilityLinks.length;

      let unknownCount = 0;
      let conflictingCount = 0;
      let qaScenarioCount = 0;

      for (const insight of analysis.insights) {
        if (insight.insightType === 'UNKNOWN') {
          unknownCount++;
        } else if (insight.certainty === 'CONFLICTING') {
          conflictingCount++;
        }
        
        if (insight.insightType === 'QA_SCENARIO') {
          qaScenarioCount++;
        }
      }

      const riskCount = unknownCount + conflictingCount;

      totalRisks += riskCount;
      totalQaScenarios += qaScenarioCount;

      const isStale = isChildAnalysisStale({
        analysisId: analysis.id,
        latestReviewDecisionId: analysis.reviewDecisions[0]?.id ?? null,
        latestReviewDecision: latestDecision,
        snapshotId: analysis.snapshot.id,
        commitSha: analysis.snapshot.commitSha,
        status: analysis.status,
        sourceTarget: {
          resolvedRefType: analysis.sourceTarget.resolvedRefType,
          latestObservedCommitSha: analysis.sourceTarget.latestObservedCommitSha,
        },
      });
      const blockingReason: MultiRepoImpactMatrixRow['blockingReason'] =
        deriveChildBlockingReason({
          status: analysis.status,
          latestReviewDecision: latestDecision,
          isStale,
        });
      
      if (latestDecision === 'ACCEPTED') {
        acceptedRepos++;
      }
      if (blockingReason !== 'NONE') {
        blockedRepos++;
      }

      rows.push({
        domain,
        repositoryId: analysis.snapshot.repositoryId,
        repositoryDisplayName: analysis.snapshot.repository.canonicalUrl.split('/').pop() ?? analysis.snapshot.repositoryId,
        language,
        framework,
        analysisId: analysis.id,
        analysisStatus: analysis.status,
        latestReviewDecision: latestDecision,
        artifactCounts,
        riskCount,
        unknownCount,
        conflictingCount,
        qaScenarioCount,
        evidenceCount,
        blockingReason,
      });
    }

    return {
      runId: run.id,
      requirementTitle: run.requirementRevision.title,
      rows,
      summary: {
        totalRepositories: analyses.length,
        domainsImpacted: Array.from(domainsSet).sort(),
        totalArtifacts,
        totalRisks,
        totalQaScenarios,
        acceptedRepos,
        blockedRepos,
      },
    };
  }
}
