import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateImpactAnalysisUseCase } from '../lifecycle/create-impact-analysis.usecase';
import { RequirementRepository } from '../../../requirement/infrastructure/requirement.repository';
import { ImpactAnalysisRepository } from '../../infrastructure/impact-analysis.repository';
import { MultiRepoAnalysisRunRepository } from '../../infrastructure/multi-repo-analysis-run.repository';
import { DomainPackRegistry } from '../../../domain-pack/application/domain-pack.registry';
import type { ResolvedDomainPackSelection } from '@ba-helper/contracts';

type PlannedRepositoryAnalysis = {
  repositoryId: string;
  repositoryDisplayName: string;
  snapshotId: string;
  sourceTargetId: string;
};

@Injectable()
export class CreateMultiRepoImpactAnalysesUseCase {
  constructor(
    private readonly createImpactAnalysis: CreateImpactAnalysisUseCase,
    private readonly impactAnalyses: ImpactAnalysisRepository,
    private readonly runs: MultiRepoAnalysisRunRepository,
    private readonly prisma: PrismaService,
    private readonly requirements: RequirementRepository,
    private readonly domainPacks: DomainPackRegistry,
  ) {}

  async execute(params: {
    actorId: string;
    projectId: string;
    requirementRevisionId: string;
    repositoryIds: string[];
    requestKey: string;
    allowPartialSnapshot: boolean;
    domainPackId?: string | null;
  }) {
    const revision = await this.requirements.findRevisionById(
      params.requirementRevisionId,
    );
    if (!revision) {
      throw new AppError(
        'REQUIREMENT_REVISION_NOT_FOUND',
        'Requirement revision not found.',
      );
    }
    if (revision.readinessStatus !== 'READY_FOR_ANALYSIS') {
      throw new AppError(
        'REQUIREMENT_REVISION_NOT_READY',
        'Requirement revision is not ready for analysis.',
      );
    }

    const requirement = await this.prisma.requirement.findUnique({
      where: { id: revision.requirementId },
    });
    if (!requirement || requirement.projectId !== params.projectId) {
      throw new AppError(
        'INPUT_PROJECT_MISMATCH',
        'Requirement revision does not belong to the selected project.',
      );
    }

    const plans = await Promise.all(
      params.repositoryIds.map((repositoryId) =>
        this.planRepositoryAnalysis(params.projectId, repositoryId),
      ),
    );
    const explicitDomainPack = params.domainPackId
      ? this.domainPacks.selectPack({ manualPackId: params.domainPackId }).resolved
      : null;

    const existingRun = await this.runs.findByProjectRequestKey(
      params.projectId,
      params.requestKey,
    );

    if (existingRun) {
      const existingRepositoryIds = existingRun.analyses
        .map((analysis) => analysis.snapshot.repositoryId)
        .sort();
      const requestedRepositoryIds = [...params.repositoryIds].sort();

      if (
        existingRun.requirementRevisionId !== params.requirementRevisionId ||
        existingRepositoryIds.length !== requestedRepositoryIds.length ||
        existingRepositoryIds.some(
          (repositoryId, index) => repositoryId !== requestedRepositoryIds[index],
        ) ||
        !existingRunMatchesDomainPack(existingRun.analyses, explicitDomainPack)
      ) {
        throw new AppError(
          'REQUEST_KEY_MISMATCH',
          'Request key reuse with different multi-repo payload.',
        );
      }
    }

    const run =
      existingRun ??
      (await this.runs.create({
        projectId: params.projectId,
        requirementRevisionId: params.requirementRevisionId,
        createdByUserId: params.actorId,
        requestKey: params.requestKey,
      }));

    const analyses = await Promise.all(
      plans.map(async (plan) => {
        const analysis = await this.createImpactAnalysis.execute({
          requirementRevisionId: params.requirementRevisionId,
          snapshotId: plan.snapshotId,
          sourceTargetId: plan.sourceTargetId,
          multiRepoRunId: run.id,
          requestKey: deriveChildRequestKey(params.requestKey, plan.repositoryId),
          allowPartialSnapshot: params.allowPartialSnapshot,
          domainPackId: params.domainPackId,
          selectedDomainPack: explicitDomainPack ?? undefined,
        });

        if (analysis.multiRepoRunId !== run.id) {
          await this.impactAnalyses.attachToMultiRepoRun(analysis.id, run.id);
        }

        return {
          analysisId: analysis.id,
          repositoryDisplayName: plan.repositoryDisplayName,
          repositoryId: plan.repositoryId,
          snapshotId: plan.snapshotId,
          sourceTargetId: plan.sourceTargetId,
          status: analysis.status,
        };
      }),
    );

    return {
      runId: run.id,
      items: analyses,
      requestKey: params.requestKey,
    };
  }

  private async planRepositoryAnalysis(
    projectId: string,
    repositoryId: string,
  ): Promise<PlannedRepositoryAnalysis> {
    const repository = await this.prisma.repository.findUnique({
      where: { id: repositoryId },
      include: {
        targets: {
          orderBy: { lastObservedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!repository || repository.projectId !== projectId) {
      throw new AppError('REPOSITORY_NOT_FOUND', 'Repository not found.');
    }

    const sourceTarget = repository.targets[0];
    if (!sourceTarget) {
      throw new AppError(
        'REPOSITORY_NOT_ANALYZABLE',
        'Repository has no observed source target to analyze.',
      );
    }

    const snapshot = await this.prisma.repositorySnapshot.findFirst({
      where: {
        repositoryId,
        commitSha: sourceTarget.latestObservedCommitSha,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!snapshot) {
      throw new AppError(
        'REPOSITORY_NOT_ANALYZABLE',
        'Repository has no published snapshot for the latest observed source target.',
      );
    }

    return {
      repositoryDisplayName:
        repository.canonicalUrl.split('/').pop() ?? repository.canonicalUrl,
      repositoryId,
      snapshotId: snapshot.id,
      sourceTargetId: sourceTarget.id,
    };
  }
}

function existingRunMatchesDomainPack(
  analyses: Array<{ metadata?: unknown }>,
  explicitDomainPack: ResolvedDomainPackSelection | null,
) {
  if (!explicitDomainPack) {
    return true;
  }

  return analyses.every((analysis) => {
    const selected = readSelectedDomainPack(analysis.metadata);
    return (
      selected?.resolvedDomainPackId === explicitDomainPack.resolvedDomainPackId &&
      selected?.resolvedDomainPackVersion === explicitDomainPack.resolvedDomainPackVersion &&
      selected?.resolvedDomainPackStatus === explicitDomainPack.resolvedDomainPackStatus &&
      selected?.selectedBy === explicitDomainPack.selectedBy
    );
  });
}

function readSelectedDomainPack(metadata: unknown): ResolvedDomainPackSelection | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const selected = (metadata as Record<string, unknown>).selectedDomainPack;
  if (!selected || typeof selected !== 'object' || Array.isArray(selected)) {
    return null;
  }

  return selected as ResolvedDomainPackSelection;
}

function deriveChildRequestKey(batchRequestKey: string, repositoryId: string): string {
  const hash = createHash('sha1')
    .update(`${batchRequestKey}:${repositoryId}`)
    .digest('hex');

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `5${hash.slice(12, 15)}`,
    `a${hash.slice(15, 18)}`,
    hash.slice(20, 32),
  ].join('-');
}
