import { Body, Controller, Get, Param, Post, Query, BadRequestException, NotFoundException, Res } from '@nestjs/common';
import {
  impactAnalysisCreateRequestSchema,
  impactAnalysisListResponseSchema,
  impactAnalysisResponseSchema,
  multiRepoImpactAnalysisCreateRequestSchema,
  multiRepoImpactAnalysisCreateResponseSchema,
  multiRepoAnalysisRunDetailResponseSchema,
  multiRepoAnalysisRunListResponseSchema,
  multiRepoImpactMatrixResponseSchema,
  multiRepoMergedReportDraftResponseSchema,
  multiRepoApprovedReportResponseSchema,
  mergedMultiRepoReportReviewDecisionCreateResponseSchema,
  mergedMultiRepoReportReviewDecisionListResponseSchema,
  mergedMultiRepoReportReviewDecisionResponseSchema,
  finalizeImpactAnalysisRequestSchema,
  impactGraphResponseSchema,
  qaCoverageResponseSchema,
  reviewQueueResponseSchema,
  paginationQuerySchema,
  impactAnalysisDiffResponseSchema,
  reviewDecisionRequestSchema,
  reviewDecisionCreateResponseSchema,
  reviewDecisionListResponseSchema,
  reviewDecisionResponseSchema,
  lineageTimelineResponseSchema,
  driftFreshnessRecommendationSchema,
  RequestUser,
} from '@ba-helper/contracts';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { CreateImpactAnalysisUseCase } from '../application/lifecycle/create-impact-analysis.usecase';
import { CreateMultiRepoImpactAnalysesUseCase } from '../application/multi-repo/create-multi-repo-impact-analyses.usecase';
import { GetImpactAnalysisUseCase } from '../application/lifecycle/get-impact-analysis.usecase';
import { GetMultiRepoAnalysisRunUseCase } from '../application/multi-repo/get-multi-repo-analysis-run.usecase';
import { BuildMultiRepoImpactMatrixReadModel } from '../application/multi-repo/build-multi-repo-impact-matrix.read-model';
import { GetMatrixRowDetailUseCase } from '../application/queries/get-matrix-row-detail.usecase';
import { GetMergedMultiRepoReportDraftUseCase } from '../application/multi-repo/get-merged-multi-repo-report-draft.usecase';
import { FinalizeMultiRepoReportUseCase } from '../application/multi-repo/finalize-multi-repo-report.usecase';
import { GetApprovedMultiRepoReportUseCase } from '../application/multi-repo/get-approved-multi-repo-report.usecase';
import { ExportApprovedMultiRepoReportUseCase } from '../application/multi-repo/export-approved-multi-repo-report.usecase';
import { ListMultiRepoAnalysisRunsUseCase } from '../application/multi-repo/list-multi-repo-analysis-runs.usecase';
import { CreateMergedMultiRepoReportReviewDecisionUseCase } from '../application/multi-repo/create-merged-multi-repo-report-review-decision.usecase';
import { ListMergedMultiRepoReportReviewDecisionsUseCase } from '../application/multi-repo/list-merged-multi-repo-report-review-decisions.usecase';
import { GetLatestMergedMultiRepoReportReviewDecisionUseCase } from '../application/multi-repo/get-latest-merged-multi-repo-report-review-decision.usecase';
import { FinalizeImpactAnalysisUseCase } from '../application/lifecycle/finalize-impact-analysis.usecase';
import { ListImpactAnalysesUseCase } from '../application/lifecycle/list-impact-analyses.usecase';
import { GetImpactGraphUseCase } from '../application/queries/get-impact-graph.usecase';
import { GetQaCoverageUseCase } from '../application/qa/get-qa-coverage.usecase';
import { GetReviewQueueUseCase } from '../application/review/get-review-queue.usecase';
import { GetImpactDiffUseCase } from '../application/queries/get-impact-diff.usecase';
import { CreateAnalysisReviewDecisionUseCase } from '../application/review/create-analysis-review-decision.usecase';
import { ListReviewDecisionsUseCase } from '../application/review/list-review-decisions.usecase';
import { GetLatestReviewDecisionUseCase } from '../application/review/get-latest-review-decision.usecase';
import { GetImpactAnalysisLineageUseCase } from '../application/queries/get-impact-analysis-lineage.usecase';
import { GetReviewCoverageUseCase } from '../application/review/get-review-coverage.usecase';
import { GetAnalysisDriftFreshnessUseCase } from '../application/queries/get-analysis-drift-freshness.usecase';
import {
  mapImpactAnalysisListItem,
  mapImpactAnalysisResponse,
  mapMergedMultiRepoReportReviewDecision,
  mapMultiRepoAnalysisRunDetail,
  mapMultiRepoAnalysisRunListItem,
  mapReviewDecision,
} from '../infrastructure/impact-analysis.mapper';

import { ProjectPermissionService } from '../../project/application/project-permission.service';

import { EventLogService } from '../../event-log/application/event-log.service';

@Controller('/api/v1')
export class ImpactAnalysisReviewController {
  constructor(
    private readonly createReviewDecision: CreateAnalysisReviewDecisionUseCase,
    private readonly listReviewDecisions: ListReviewDecisionsUseCase,
    private readonly getLatestReviewDecision: GetLatestReviewDecisionUseCase,
    private readonly getReviewCoverage: GetReviewCoverageUseCase,
    private readonly permissions: ProjectPermissionService,
  ) {}

  @Get('/multi-repo-runs/:runId/review-coverage')
  async getReviewCoverageEndpoint(
    @Param('runId') runId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    // Permission is checked within the use case
    const result = await this.getReviewCoverage.execute(actor, runId);
    return result; // result is already validated by contract schema format implicitly, or we can use reviewCoverageResponseSchema.parse
  }

  @Post('/impact-analyses/:analysisId/review-decisions')
  async createReviewDecisionEndpoint(
    @Param('analysisId') analysisId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertPermissionForAnalysis(
      actor,
      analysisId,
      'review:write',
    );
    const input = reviewDecisionRequestSchema.parse(body);

    const result = await this.createReviewDecision.execute({
      analysisId,
      decision: input.decision,
      note: input.note,
      actor,
    });

    return reviewDecisionCreateResponseSchema.parse({
      decision: mapReviewDecision(result.decision),
      reportRegenerated: result.reportRegenerated,
      reportRegenerationError: result.reportRegenerationError,
    });
  }

  @Get('/impact-analyses/:analysisId/review-decisions')
  async listReviewDecisionsEndpoint(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadAnalysis(actor, analysisId);
    const result = await this.listReviewDecisions.execute(analysisId);
    return reviewDecisionListResponseSchema.parse({
      items: result.items.map(mapReviewDecision),
    });
  }

  @Get('/impact-analyses/:analysisId/review-decisions/latest')
  async getLatestReviewDecisionEndpoint(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadAnalysis(actor, analysisId);
    const result = await this.getLatestReviewDecision.execute(analysisId);
    if (!result) {
      throw new NotFoundException('No review decisions found for this analysis.');
    }
    return reviewDecisionResponseSchema.parse(mapReviewDecision(result));
  }
}
