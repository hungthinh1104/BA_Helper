import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GetRepositorySnapshotDriftUseCase } from '../../repository/application/get-repository-snapshot-drift.usecase';
import { ImpactAnalysisRepository } from '../infrastructure/impact-analysis.repository';
import { DriftFreshnessRecommendation } from '@ba-helper/contracts';

@Injectable()
export class GetAnalysisDriftFreshnessUseCase {
  constructor(
    private readonly analysisRepo: ImpactAnalysisRepository,
    private readonly prisma: PrismaService,
    private readonly getDrift: GetRepositorySnapshotDriftUseCase,
  ) {}

  async execute(projectId: string, analysisId: string): Promise<DriftFreshnessRecommendation> {
    const analysis = await this.analysisRepo.findById(analysisId);
    if (!analysis) {
      throw new NotFoundException('Analysis not found.');
    }

    if (analysis.snapshot.repository.projectId !== projectId) {
      throw new NotFoundException('Analysis does not belong to the requested project.');
    }

    const latestUsableSnapshot = await this.prisma.repositorySnapshot.findFirst({
      where: {
        repositoryId: analysis.snapshot.repositoryId,
        coverageStatus: { in: ['READY', 'PARTIAL'] },
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
    });

    if (!latestUsableSnapshot) {
      return {
        status: 'UNKNOWN',
        severity: 'WARN',
        shouldReviewBeforeUse: true,
        shouldRerunAnalysis: false,
        reason: 'No usable repository snapshot is available for freshness comparison.',
      };
    }

    if (latestUsableSnapshot.id === analysis.snapshotId) {
      return {
        status: 'CURRENT',
        severity: 'INFO',
        shouldReviewBeforeUse: false,
        shouldRerunAnalysis: false,
        reason: 'This analysis is based on the latest usable repository snapshot.',
      };
    }

    const driftResult = await this.getDrift.execute({
      projectId,
      repositoryId: analysis.snapshot.repositoryId,
      baseSnapshotId: analysis.snapshotId,
      targetSnapshotId: latestUsableSnapshot.id,
    });

    const summary = driftResult.summary;

    if (driftResult.status === 'NO_DRIFT') {
      return {
        status: 'CURRENT',
        severity: 'INFO',
        shouldReviewBeforeUse: false,
        shouldRerunAnalysis: false,
        reason: 'This analysis is based on a snapshot that is identical to the latest usable repository snapshot.',
      };
    }

    if (driftResult.status === 'INCOMPATIBLE') {
      return {
        status: 'INCOMPATIBLE',
        severity: 'HIGH',
        shouldReviewBeforeUse: true,
        shouldRerunAnalysis: true,
        reason: 'Repository scanner/analyzer versions changed significantly. Re-analysis is recommended.',
        driftSummary: summary,
      };
    }

    if (driftResult.status === 'UNKNOWN') {
      return {
        status: 'UNKNOWN',
        severity: 'WARN',
        shouldReviewBeforeUse: true,
        shouldRerunAnalysis: false,
        reason: 'Repository freshness cannot be fully determined because some artifacts do not have content hashes.',
        driftSummary: summary,
      };
    }

    // Status is DRIFTED
    const hasChangesOrRemovals = summary.changedArtifactCount > 0 || summary.removedArtifactCount > 0;
    const isOnlyAdditions = summary.addedArtifactCount > 0 && !hasChangesOrRemovals;

    return {
      status: 'DRIFTED',
      severity: hasChangesOrRemovals ? 'HIGH' : 'WARN',
      shouldReviewBeforeUse: true,
      shouldRerunAnalysis: hasChangesOrRemovals,
      reason: 'The repository has changed since this analysis was created. Review the drift summary before relying on this result.',
      driftSummary: summary,
    };
  }
}
