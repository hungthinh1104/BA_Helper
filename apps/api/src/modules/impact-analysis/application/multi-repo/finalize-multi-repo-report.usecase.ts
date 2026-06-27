import { Injectable } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { GetMergedMultiRepoReportDraftUseCase } from './get-merged-multi-repo-report-draft.usecase';
import { MultiRepoAnalysisRunRepository } from '../../infrastructure/multi-repo-analysis-run.repository';
import { MultiRepoMergedReportRepository } from '../../infrastructure/multi-repo-merged-report.repository';
import { GetApprovedMultiRepoReportUseCase } from './get-approved-multi-repo-report.usecase';
import { RequestUser } from '@ba-helper/contracts';
import type { DomainPackSelectedBy, DomainProfileCapabilityStatus } from '@ba-helper/contracts';
import {
  deriveMergedReportState,
  MultiRepoChildState,
  normalizeChildProvenance,
  StoredChildProvenance,
} from './multi-repo-merged-report-state';

@Injectable()
export class FinalizeMultiRepoReportUseCase {
  constructor(
    private readonly runs: MultiRepoAnalysisRunRepository,
    private readonly draft: GetMergedMultiRepoReportDraftUseCase,
    private readonly reports: MultiRepoMergedReportRepository,
    private readonly getApproved: GetApprovedMultiRepoReportUseCase,
  ) {}

  async execute(runId: string, actor: RequestUser) {
    const run = await this.runs.findById(runId);
    if (!run) {
      throw new AppError(
        'MULTI_REPO_ANALYSIS_RUN_NOT_FOUND',
        'Multi-repo analysis run not found.',
      );
    }

    const initialChildren = toChildStates(run.analyses);
    const initialState = deriveMergedReportState({
      children: initialChildren,
      approvedReportProvenance: run.approvedMergedReport?.provenance,
    });

    if (!initialState.runReadiness.canStartMergedReport) {
      throw new AppError(
        'MULTI_REPO_RUN_NOT_READY',
        'Multi-repo analysis run is not ready for a merged report.',
      );
    }

    const initialProvenance = buildApprovedChildProvenance(initialChildren);

    try {
      const existingApproved = await this.getApproved.execute(runId);
      if (!existingApproved.isStale) {
        return existingApproved;
      }
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== 'MERGED_MULTI_REPO_REPORT_NOT_FOUND') {
        throw error;
      }
    }

    const draft = await this.draft.execute(runId, actor);
    const revalidatedRun = await this.runs.findById(runId);
    if (!revalidatedRun) {
      throw new AppError(
        'MULTI_REPO_ANALYSIS_RUN_NOT_FOUND',
        'Multi-repo analysis run not found.',
      );
    }
    const revalidatedChildren = toChildStates(revalidatedRun.analyses);
    const revalidatedState = deriveMergedReportState({
      children: revalidatedChildren,
      approvedReportProvenance: revalidatedRun.approvedMergedReport?.provenance,
    });
    const revalidatedProvenance =
      buildApprovedChildProvenance(revalidatedChildren);

    if (
      !revalidatedState.runReadiness.canStartMergedReport ||
      !sameChildProvenance(initialProvenance, revalidatedProvenance)
    ) {
      throw new AppError(
        'MULTI_REPO_RUN_NOT_READY',
        'Multi-repo analysis run changed during merged report finalization. Refresh and retry.',
      );
    }

    await this.reports.upsertApproved({
      runId,
      content: draft.markdown,
      provenance: {
        domainPack: readRunDomainPackProvenance(revalidatedRun.analyses),
        childAnalyses: revalidatedProvenance,
      },
    });

    return this.getApproved.execute(runId);
  }
}

function toChildStates(
  analyses: Array<{
    id: string;
    status: MultiRepoChildState['status'];
    reviewDecisions: Array<{
      id: string;
      decision: NonNullable<MultiRepoChildState['latestReviewDecision']>;
    }>;
    snapshot: {
      id: string;
      commitSha: string;
    };
    sourceTarget: {
      resolvedRefType: MultiRepoChildState['sourceTarget']['resolvedRefType'];
      latestObservedCommitSha: string;
    };
    metadata?: unknown;
  }>,
): MultiRepoChildState[] {
  return analyses.map((analysis) => {
    const latestDecision = analysis.reviewDecisions[0] ?? null;

    return {
      analysisId: analysis.id,
      latestReviewDecisionId: latestDecision?.id ?? null,
      latestReviewDecision: latestDecision?.decision ?? null,
      snapshotId: analysis.snapshot.id,
      commitSha: analysis.snapshot.commitSha,
      status: analysis.status,
      sourceTarget: {
        resolvedRefType: analysis.sourceTarget.resolvedRefType,
        latestObservedCommitSha: analysis.sourceTarget.latestObservedCommitSha,
      },
    };
  });
}

function readRunDomainPackProvenance(
  analyses: Array<{ metadata?: unknown }>,
): {
  domainPackId: string;
  domainPackVersion: string;
  domainPackStatus: DomainProfileCapabilityStatus;
  selectedBy: DomainPackSelectedBy;
} | null {
  const first = analyses[0] ? readDomainPackProvenance(analyses[0].metadata) : null;
  if (!first) return null;

  const allSame = analyses.every((analysis) => {
    const next = readDomainPackProvenance(analysis.metadata);
    return (
      next?.domainPackId === first.domainPackId &&
      next?.domainPackVersion === first.domainPackVersion &&
      next?.domainPackStatus === first.domainPackStatus &&
      next?.selectedBy === first.selectedBy
    );
  });

  return allSame ? first : null;
}

function readDomainPackProvenance(metadata: unknown): {
  domainPackId: string;
  domainPackVersion: string;
  domainPackStatus: DomainProfileCapabilityStatus;
  selectedBy: DomainPackSelectedBy;
} | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const provenance = (metadata as Record<string, unknown>).reportProvenance;
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) {
    return null;
  }

  const data = provenance as Record<string, unknown>;
  if (
    typeof data.domainPackId !== 'string' ||
    typeof data.domainPackVersion !== 'string' ||
    !isDomainPackStatus(data.domainPackStatus) ||
    !isDomainPackSelectedBy(data.selectedBy)
  ) {
    return null;
  }

  return {
    domainPackId: data.domainPackId,
    domainPackVersion: data.domainPackVersion,
    domainPackStatus: data.domainPackStatus,
    selectedBy: data.selectedBy,
  };
}

function isDomainPackStatus(value: unknown): value is DomainProfileCapabilityStatus {
  return (
    value === 'STABLE' ||
    value === 'PARTIAL' ||
    value === 'EXPERIMENTAL' ||
    value === 'FALLBACK'
  );
}

function isDomainPackSelectedBy(value: unknown): value is DomainPackSelectedBy {
  return (
    value === 'EXPLICIT' ||
    value === 'REPOSITORY_PROFILE' ||
    value === 'FALLBACK'
  );
}

function buildApprovedChildProvenance(
  children: MultiRepoChildState[],
): StoredChildProvenance[] {
  return normalizeChildProvenance(
    children.map((child) => {
      if (!child.latestReviewDecisionId) {
        throw new AppError(
          'MULTI_REPO_RUN_NOT_READY',
          'Multi-repo analysis run is not ready for a merged report.',
        );
      }

      return {
        analysisId: child.analysisId,
        latestReviewDecisionId: child.latestReviewDecisionId,
        snapshotId: child.snapshotId,
        commitSha: child.commitSha,
      };
    }),
  );
}

function sameChildProvenance(
  left: StoredChildProvenance[],
  right: StoredChildProvenance[],
): boolean {
  return JSON.stringify(normalizeChildProvenance(left)) ===
    JSON.stringify(normalizeChildProvenance(right));
}
