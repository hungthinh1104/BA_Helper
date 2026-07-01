import { Injectable } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { MergedMultiRepoReportDraftBuilder } from './merged-multi-repo-report-draft.builder';
import { BuildMultiRepoImpactMatrixReadModel } from './build-multi-repo-impact-matrix.read-model';
import { GetReviewCoverageUseCase } from '../review/get-review-coverage.usecase';
import { RequestUser } from '@ba-helper/contracts';
import { parseScanHealthPayload } from '../qa/scan-health-report.formatter';
import {
  deriveMergedReportState,
  MultiRepoChildState,
} from './multi-repo-merged-report-state';
import { InsightRepository, TraceabilityRepository, MultiRepoAnalysisRunRepository } from "@ba-helper/backend-runtime";

@Injectable()
export class GetMergedMultiRepoReportDraftUseCase {
  constructor(
    private readonly runs: MultiRepoAnalysisRunRepository,
    private readonly insights: InsightRepository,
    private readonly traceability: TraceabilityRepository,
    private readonly builder: MergedMultiRepoReportDraftBuilder,
    private readonly matrixReadModel: BuildMultiRepoImpactMatrixReadModel,
    private readonly reviewCoverage: GetReviewCoverageUseCase,
  ) {}

  async execute(runId: string, actor: RequestUser) {
    const run = await this.runs.findById(runId);
    if (!run) {
      throw new AppError(
        'MULTI_REPO_ANALYSIS_RUN_NOT_FOUND',
        'Multi-repo analysis run not found.',
      );
    }

    const childStates: MultiRepoChildState[] = run.analyses.map((analysis) => ({
      analysisId: analysis.id,
      latestReviewDecisionId: analysis.reviewDecisions?.[0]?.id ?? null,
      latestReviewDecision: analysis.reviewDecisions?.[0]?.decision ?? null,
      snapshotId: analysis.snapshot.id,
      commitSha: analysis.snapshot.commitSha,
      status: analysis.status,
      sourceTarget: {
        resolvedRefType: analysis.sourceTarget.resolvedRefType,
        latestObservedCommitSha: analysis.sourceTarget.latestObservedCommitSha,
      },
    }));
    const mergedReportState = deriveMergedReportState({
      children: childStates,
    });

    if (!mergedReportState.runReadiness.canStartMergedReport) {
      throw new AppError(
        'MULTI_REPO_RUN_NOT_READY',
        'Multi-repo analysis run is not ready for a merged report draft.',
      );
    }

    const generatedAt = new Date().toISOString();
    const children = await Promise.all(
      run.analyses.map(async (analysis) => {
        const repositoryDisplayName =
          analysis.snapshot.repository.canonicalUrl.split('/').pop() ??
          analysis.snapshot.repository.canonicalUrl;

        return {
          analysisId: analysis.id,
          repositoryId: analysis.snapshot.repositoryId,
          repositoryDisplayName,
          snapshotId: analysis.snapshot.id,
          commitSha: analysis.snapshot.commitSha,
          sourceTargetRef: analysis.sourceTarget.requestedRef,
          latestReviewDecision: analysis.reviewDecisions?.[0]?.decision ?? null,
          insights: await this.insights.listByAnalysis(analysis.id),
          traceabilityLinks: await this.traceability.listByAnalysis(analysis.id),
          scanHealth: parseScanHealthPayload(
            ((analysis.snapshot.diagnostics as any[]) ?? []).find(
              (d: any) => d?.code === 'SCAN_HEALTH',
            )?.payload,
          ),
        };
      }),
    );

    const matrix = await this.matrixReadModel.execute(runId);
    const coverage = await this.reviewCoverage.execute(actor, runId);

    return {
      runId: run.id,
      projectId: run.projectId,
      requirementRevisionId: run.requirementRevisionId,
      requirementTitle: run.requirementRevision.title,
      generatedAt,
      childAnalysisCount: children.length,
      repositories: children.map((child) => ({
        repositoryId: child.repositoryId,
        repositoryDisplayName: child.repositoryDisplayName,
        analysisId: child.analysisId,
        snapshotId: child.snapshotId,
        commitSha: child.commitSha,
      })),
      markdown: this.builder.build({
        runId: run.id,
        projectId: run.projectId,
        requirementRevisionId: run.requirementRevisionId,
        requirementTitle: run.requirementRevision.title,
        requirementRawText: run.requirementRevision.rawText,
        generatedAt,
        children,
        matrix,
        reviewCoverage: coverage,
      }),
    };
  }
}
