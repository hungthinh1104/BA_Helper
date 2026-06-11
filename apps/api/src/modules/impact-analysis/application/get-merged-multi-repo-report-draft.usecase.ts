import { Injectable } from '@nestjs/common';
import { AppError } from '../../../shared/app-error';
import { deriveMultiRepoRunAggregates } from './multi-repo-run-readiness';
import { InsightRepository } from '../../insight/infrastructure/insight.repository';
import { TraceabilityRepository } from '../../traceability/infrastructure/traceability.repository';
import { MultiRepoAnalysisRunRepository } from '../infrastructure/multi-repo-analysis-run.repository';
import { MergedMultiRepoReportDraftBuilder } from './merged-multi-repo-report-draft.builder';

@Injectable()
export class GetMergedMultiRepoReportDraftUseCase {
  constructor(
    private readonly runs: MultiRepoAnalysisRunRepository,
    private readonly insights: InsightRepository,
    private readonly traceability: TraceabilityRepository,
    private readonly builder: MergedMultiRepoReportDraftBuilder,
  ) {}

  async execute(runId: string) {
    const run = await this.runs.findById(runId);
    if (!run) {
      throw new AppError(
        'MULTI_REPO_ANALYSIS_RUN_NOT_FOUND',
        'Multi-repo analysis run not found.',
      );
    }

    const aggregates = deriveMultiRepoRunAggregates(
      run.analyses.map((analysis) => ({
        status: analysis.status,
        latestReviewDecision: analysis.reviewDecisions?.[0]?.decision ?? null,
      })),
    );

    if (!aggregates.runReadiness.canStartMergedReport) {
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
        };
      }),
    );

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
      }),
    };
  }
}
