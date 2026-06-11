import { Injectable } from '@nestjs/common';
import { ImpactAnalysisRepository } from '../infrastructure/impact-analysis.repository';
import { RequirementRepository } from '../../requirement/infrastructure/requirement.repository';
import { AppError } from '../../../shared/app-error';
import { ImpactAnalysisPolicy } from '../domain/impact-analysis.policy';
import { EventLogService } from '../../event-log/application/event-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';


@Injectable()
export class CreateImpactAnalysisUseCase {
  constructor(
    private readonly impactRepo: ImpactAnalysisRepository,
    private readonly requirementRepo: RequirementRepository,
    private readonly prisma: PrismaService,
    private readonly eventLog: EventLogService,
    private readonly queue: QueueService,
  ) {}

  async execute(params: {
    requirementRevisionId: string;
    snapshotId: string;
    sourceTargetId: string;
    requestKey: string;
    allowPartialSnapshot: boolean;
  }) {
    const revision = await this.requirementRepo.findRevisionById(
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

    const snapshot = await this.prisma.repositorySnapshot.findUnique({
      where: { id: params.snapshotId },
      include: { repository: true },
    });

    if (!snapshot) {
      throw new AppError('SNAPSHOT_NOT_FOUND', 'Snapshot not found.');
    }

    const requirement = await this.prisma.requirement.findUnique({
      where: { id: revision.requirementId },
    });

    if (requirement?.projectId !== snapshot.repository.projectId) {
      throw new AppError(
        'INPUT_PROJECT_MISMATCH',
        'Requirement and repository belong to different projects.',
      );
    }

    const sourceTarget = await this.prisma.repositoryTarget.findUnique({
      where: { id: params.sourceTargetId },
    });

    if (!sourceTarget) {
      throw new AppError('SOURCE_TARGET_NOT_FOUND', 'Source target not found.');
    }

    if (sourceTarget.repositoryId !== snapshot.repositoryId) {
      throw new AppError(
        'SOURCE_TARGET_NOT_FOUND',
        'Source target does not match snapshot repository.',
      );
    }

    if (
      sourceTarget.resolvedRefType !== 'COMMIT' &&
      sourceTarget.latestObservedCommitSha !== snapshot.commitSha
    ) {
      throw new AppError('ANALYSIS_STALE', 'Snapshot is stale for source target.');
    }

    if (
      !ImpactAnalysisPolicy.canAnalyzeSnapshot({
        coverageStatus: snapshot.coverageStatus,
        allowPartialSnapshot: params.allowPartialSnapshot,
      })
    ) {
      throw new AppError(
        'SNAPSHOT_PARTIAL_NOT_ALLOWED',
        'Partial snapshot requires explicit acceptance.',
      );
    }

    const existingByRequestKey = await this.impactRepo.findByRequestKey({
      requestKey: params.requestKey,
    });

    if (
      existingByRequestKey &&
      (existingByRequestKey.snapshotId !== params.snapshotId ||
        existingByRequestKey.sourceTargetId !== params.sourceTargetId ||
        existingByRequestKey.requirementRevisionId !== params.requirementRevisionId)
    ) {
      throw new AppError(
        'REQUEST_KEY_MISMATCH',
        'Request key reuse with different payload.',
      );
    }

    const existing = await this.impactRepo.findByComposite(params);
    if (existing) {
      return existing;
    }

    const coverageWarning =
      snapshot.coverageStatus === 'PARTIAL' && params.allowPartialSnapshot
        ? 'Partial snapshot accepted; coverage may be incomplete.'
        : null;

    const analysis = await this.impactRepo.createQueued({
      requirementRevisionId: params.requirementRevisionId,
      snapshotId: params.snapshotId,
      sourceTargetId: params.sourceTargetId,
      requestKey: params.requestKey,
      acceptedPartialCoverage:
        snapshot.coverageStatus === 'PARTIAL' && params.allowPartialSnapshot,
      coverageWarning,
    });

    await this.eventLog.recordEvent({
      eventType: 'IMPACT_ANALYSIS_QUEUED',
      idempotencyKey: `impact:${analysis.id}:queued`,
      payload: {
        impactAnalysisId: analysis.id,
        requirementRevisionId: analysis.requirementRevisionId,
        snapshotId: analysis.snapshotId,
      },
    });

    await this.queue.enqueueImpactAnalysis(analysis.id);

    return analysis;
  }
}
