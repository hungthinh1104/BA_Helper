import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { CreateImpactAnalysisUseCase } from '../lifecycle/create-impact-analysis.usecase';
import { RequirementRepository } from '../../../requirement/infrastructure/requirement.repository';
import { DomainPackRegistry, PrismaService, ImpactAnalysisRepository, MultiRepoAnalysisRunRepository } from '@ba-helper/backend-runtime';
import {
  assertRunRequestMatches,
  hashMultiRepoRequestPayload,
  isUniqueConstraintError,
  reconstructMultiRepoRequestPlan,
  readMultiRepoRequestPlan,
  type MultiRepoRequestPlanEntry,
} from './multi-repo-request-payload';

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

    const explicitDomainPack = params.domainPackId
      ? this.domainPacks.selectPack({ manualPackId: params.domainPackId }).resolved
      : null;
    const requestPayloadHash = hashMultiRepoRequestPayload({
      requirementRevisionId: params.requirementRevisionId,
      repositoryIds: params.repositoryIds,
      allowPartialSnapshot: params.allowPartialSnapshot,
      explicitDomainPack,
    });

    const existingRun = await this.runs.findByProjectRequestKey(
      params.projectId,
      params.requestKey,
    );

    if (existingRun) {
      assertRunRequestMatches(existingRun, {
        requirementRevisionId: params.requirementRevisionId,
        repositoryIds: params.repositoryIds,
        explicitDomainPack,
        requestPayloadHash,
      });
    }

    let plans = existingRun
      ? await this.resolveExistingRequestPlan(existingRun, params.repositoryIds, requestPayloadHash)
      : await this.planRepositories(params.projectId, params.repositoryIds);

    let run = existingRun;
    if (!run) {
      try {
        run = await this.runs.create({
          projectId: params.projectId,
          requirementId: revision.requirementId,
          requirementRevisionId: params.requirementRevisionId,
          createdByUserId: params.actorId,
          requestKey: params.requestKey,
          requestPayloadHash,
          requestPlan: plans,
          selectedDomainPack: explicitDomainPack,
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        run = await this.runs.findByProjectRequestKey(
          params.projectId,
          params.requestKey,
        );
        if (!run) throw error;
        assertRunRequestMatches(run, {
          requirementRevisionId: params.requirementRevisionId,
          repositoryIds: params.repositoryIds,
          explicitDomainPack,
          requestPayloadHash,
        });
        plans = await this.resolveExistingRequestPlan(run, params.repositoryIds, requestPayloadHash);
      }
    }

    const analyses = await Promise.all(
      plans.map(async (plan) => {
        const analysis = await this.createImpactAnalysis.execute({
          requirementRevisionId: params.requirementRevisionId,
          snapshotId: plan.snapshotId,
          sourceTargetId: plan.sourceTargetId,
          multiRepoRunId: run.id,
          actorUserId: params.actorId,
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

  private async resolveExistingRequestPlan(
    run: NonNullable<Awaited<ReturnType<MultiRepoAnalysisRunRepository['findByProjectRequestKey']>>>,
    repositoryIds: string[],
    requestPayloadHash: string,
  ): Promise<MultiRepoRequestPlanEntry[]> {
    const persisted = readMultiRepoRequestPlan(run.requestPlan, repositoryIds);
    if (persisted) return persisted;

    const reconstructed = reconstructMultiRepoRequestPlan(run, repositoryIds);
    if (!reconstructed) {
      throw new AppError(
        'MULTI_REPO_RUN_NOT_READY',
        'This legacy multi-repo run has no complete snapshot plan and cannot be resumed safely. Start a new run with a new request key.',
      );
    }

    await this.runs.backfillRequestPlan({
      id: run.id,
      requestPayloadHash,
      requestPlan: reconstructed,
    });
    return reconstructed;
  }

  private async planRepositoryAnalysis(
    projectId: string,
    repositoryId: string,
  ): Promise<MultiRepoRequestPlanEntry> {
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

  private async planRepositories(projectId: string, repositoryIds: string[]) {
    return Promise.all(repositoryIds.map((repositoryId) =>
      this.planRepositoryAnalysis(projectId, repositoryId),
    ));
  }
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
