import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequirementRepository } from '../../../requirement/infrastructure/requirement.repository';
import { AppError } from '@ba-helper/shared';
import { ImpactAnalysisPolicy } from '../../domain/impact-analysis.policy';
import { DomainPackRegistry, PrismaService, ImpactAnalysisRepository, QueueService, EventLogService } from '@ba-helper/backend-runtime';
import type { ResolvedDomainPackSelection } from '@ba-helper/contracts';
import {
  readResolvedDomainPackSelection,
  sameResolvedDomainPackSelection,
} from '@ba-helper/application';


@Injectable()
export class CreateImpactAnalysisUseCase {
  private readonly logger = new Logger(CreateImpactAnalysisUseCase.name)

  constructor(
    private readonly impactRepo: ImpactAnalysisRepository,
    private readonly requirementRepo: RequirementRepository,
    private readonly prisma: PrismaService,
    private readonly eventLog: EventLogService,
    private readonly queue: QueueService,
    private readonly domainPacks: DomainPackRegistry,
  ) {}

  async execute(params: {
    requirementRevisionId: string;
    snapshotId: string;
    sourceTargetId: string;
    requestKey: string;
    allowPartialSnapshot: boolean;
    multiRepoRunId?: string;
    derivedFromAnalysisId?: string;
    sourceClarificationId?: string;
    reviewClarificationRequestId?: string;
    domainPackId?: string | null;
    selectedDomainPack?: ResolvedDomainPackSelection;
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
      include: { repository: true, profile: true },
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

    if (params.derivedFromAnalysisId || params.sourceClarificationId || params.reviewClarificationRequestId) {
      if (!params.derivedFromAnalysisId) {
        throw new AppError('INVALID_LINEAGE', 'derivedFromAnalysisId must be provided.');
      }
      
      if (params.sourceClarificationId) {
        const clarification = await this.prisma.clarificationItem.findUnique({
          where: { id: params.sourceClarificationId },
          include: { impactAnalysis: { include: { snapshot: { include: { repository: true } } } } }
        });

        if (!clarification) {
          throw new AppError('CLARIFICATION_NOT_FOUND', 'Source clarification not found.');
        }
        if (clarification.impactAnalysisId !== params.derivedFromAnalysisId) {
          throw new AppError('INVALID_LINEAGE', 'Clarification does not belong to the derived analysis.');
        }
        if (clarification.status !== 'CONVERTED_TO_REVISION') {
          throw new AppError('INVALID_LINEAGE', 'Clarification must be CONVERTED_TO_REVISION to spawn a new analysis.');
        }
        if (clarification.convertedRequirementRevisionId !== params.requirementRevisionId) {
          throw new AppError('INVALID_LINEAGE', 'Requested requirement revision does not match the clarification converted revision.');
        }
        if (clarification.impactAnalysis.snapshot.repository.projectId !== snapshot.repository.projectId) {
          throw new AppError('INVALID_LINEAGE', 'New analysis project does not match old analysis project.');
        }
      }

      if (params.reviewClarificationRequestId) {
        const reviewClarification = await this.prisma.reviewClarificationRequest.findUnique({
          where: { id: params.reviewClarificationRequestId },
          include: { analysis: { include: { snapshot: { include: { repository: true } } } } }
        });

        if (!reviewClarification) {
          throw new AppError('CLARIFICATION_NOT_FOUND', 'Review clarification not found.');
        }
        if (reviewClarification.analysisId !== params.derivedFromAnalysisId) {
          throw new AppError('INVALID_LINEAGE', 'Review clarification does not belong to the derived analysis.');
        }
        if (reviewClarification.status !== 'ANSWERED') {
          throw new AppError('INVALID_LINEAGE', 'Review clarification must be ANSWERED to spawn a new analysis.');
        }
        if (reviewClarification.analysis.snapshot.repository.projectId !== snapshot.repository.projectId) {
          throw new AppError('INVALID_LINEAGE', 'New analysis project does not match old analysis project.');
        }
      }
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

    const selectedDomainPack =
      params.selectedDomainPack ??
      this.domainPacks.selectPack({
        manualPackId: params.domainPackId ?? null,
        repositoryProfileDomain: snapshot.profile?.domain ?? null,
      }).resolved;

    const existingByRequestKey = await this.impactRepo.findByRequestKey({
      requestKey: params.requestKey,
    });

    if (
      existingByRequestKey &&
      (existingByRequestKey.snapshotId !== params.snapshotId ||
        existingByRequestKey.sourceTargetId !== params.sourceTargetId ||
        existingByRequestKey.requirementRevisionId !== params.requirementRevisionId ||
        !sameResolvedDomainPackSelection(
          readResolvedDomainPackSelection(existingByRequestKey),
          selectedDomainPack,
        ))
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

    let analysis
    try {
      analysis = await this.impactRepo.createQueued({
        requirementRevisionId: params.requirementRevisionId,
        snapshotId: params.snapshotId,
        sourceTargetId: params.sourceTargetId,
        multiRepoRunId: params.multiRepoRunId,
        requestKey: params.requestKey,
        acceptedPartialCoverage:
          snapshot.coverageStatus === 'PARTIAL' && params.allowPartialSnapshot,
        coverageWarning,
        derivedFromAnalysisId: params.derivedFromAnalysisId,
        sourceClarificationId: params.sourceClarificationId,
        reviewClarificationRequestId: params.reviewClarificationRequestId,
        selectedDomainPack,
        metadata: {
          selectedDomainPack,
          domainPack: {
            id: selectedDomainPack.resolvedDomainPackId,
            version: selectedDomainPack.resolvedDomainPackVersion,
            status: selectedDomainPack.resolvedDomainPackStatus,
            selectedBy: selectedDomainPack.selectedBy,
          },
          reportProvenance: {
            domainPackId: selectedDomainPack.resolvedDomainPackId,
            domainPackVersion: selectedDomainPack.resolvedDomainPackVersion,
            domainPackStatus: selectedDomainPack.resolvedDomainPackStatus,
            selectedBy: selectedDomainPack.selectedBy,
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existingAfterRace = await this.impactRepo.findByComposite(params)
        if (existingAfterRace) {
          return existingAfterRace
        }
      }

      this.logger.error(`CreateImpactAnalysis createQueued failed: ${(error as Error)?.message ?? error}`)
      throw error
    }

    await this.eventLog.recordEvent({
      eventType: 'IMPACT_ANALYSIS_QUEUED',
      idempotencyKey: `impact:${analysis.id}:queued`,
      payload: {
        impactAnalysisId: analysis.id,
        requirementRevisionId: analysis.requirementRevisionId,
        snapshotId: analysis.snapshotId,
      },
    });

    try {
      await this.queue.enqueueImpactAnalysis(analysis.id);
    } catch (error) {
      await this.impactRepo.updateStatus({
        id: analysis.id,
        status: 'FAILED',
        stage: 'DONE',
        progress: 0,
        error: {
          code: 'QUEUE_ENQUEUE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to enqueue impact analysis job.',
        },
      });
      this.logger.error(`Failed to enqueue analysis ${analysis.id}: ${(error as Error)?.message ?? error}`)
      throw error
    }

    return analysis;
  }
}
