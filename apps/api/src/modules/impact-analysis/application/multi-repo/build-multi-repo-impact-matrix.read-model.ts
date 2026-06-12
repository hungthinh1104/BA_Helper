import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MultiRepoAnalysisRunRepository } from '../../infrastructure/multi-repo-analysis-run.repository';
import { MultiRepoImpactMatrixResponse, MultiRepoImpactMatrixRow } from '@ba-helper/contracts';

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

      // Ensure review status logic aligns with blocking reason
      let blockingReason: MultiRepoImpactMatrixRow['blockingReason'] = 'NONE';
      if (analysis.status === 'FAILED') {
        blockingReason = 'FAILED';
      } else if (latestDecision === 'NEEDS_MORE_CLARIFICATION') {
        blockingReason = 'NEEDS_MORE_CLARIFICATION';
      } else if (latestDecision === 'REJECTED') {
        blockingReason = 'REJECTED';
      } else if (analysis.status === 'WAITING_FOR_REVIEW') {
        blockingReason = 'WAITING_FOR_REVIEW';
      } else if (analysis.status !== 'COMPLETED') {
        blockingReason = 'NOT_COMPLETED';
      }
      
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
