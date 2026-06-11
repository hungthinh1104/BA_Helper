import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { AppError } from '../../../shared/app-error';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateImpactAnalysisUseCase } from './create-impact-analysis.usecase';
import { RequirementRepository } from '../../requirement/infrastructure/requirement.repository';

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
    private readonly prisma: PrismaService,
    private readonly requirements: RequirementRepository,
  ) {}

  async execute(params: {
    projectId: string;
    requirementRevisionId: string;
    repositoryIds: string[];
    requestKey: string;
    allowPartialSnapshot: boolean;
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

    const analyses = await Promise.all(
      plans.map(async (plan) => {
        const analysis = await this.createImpactAnalysis.execute({
          requirementRevisionId: params.requirementRevisionId,
          snapshotId: plan.snapshotId,
          sourceTargetId: plan.sourceTargetId,
          requestKey: deriveChildRequestKey(params.requestKey, plan.repositoryId),
          allowPartialSnapshot: params.allowPartialSnapshot,
        });

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
