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
  analysisWorkspaceResponseSchema,
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
import { CreateAnalysisReviewDecisionUseCase } from '../application/review/create-analysis-review-decision.usecase';
import { ListReviewDecisionsUseCase } from '../application/review/list-review-decisions.usecase';
import { GetLatestReviewDecisionUseCase } from '../application/review/get-latest-review-decision.usecase';
import { GetImpactAnalysisLineageUseCase } from '../application/queries/get-impact-analysis-lineage.usecase';
import { GetReviewCoverageUseCase } from '../application/review/get-review-coverage.usecase';
import { GetAnalysisDriftFreshnessUseCase } from '../application/queries/get-analysis-drift-freshness.usecase';
import { GetAnalysisWorkspaceUseCase } from '../application/queries/get-analysis-workspace.usecase';
import {
  mapImpactAnalysisListItem,
  mapImpactAnalysisResponse,
  mapMergedMultiRepoReportReviewDecision,
  mapMultiRepoAnalysisRunDetail,
  mapMultiRepoAnalysisRunListItem,
  mapReviewDecision,
} from '../infrastructure/impact-analysis.mapper';

import { ProjectPermissionService } from '../../project/application/project-permission.service';
import { GetImpactDiffUseCase, EventLogService } from "@ba-helper/backend-runtime";

@Controller('/api/v1')
export class ImpactAnalysisReadModelController {
  constructor(
    private readonly getMatrixRowDetail: GetMatrixRowDetailUseCase,
    private readonly getImpactGraph: GetImpactGraphUseCase,
    private readonly getQaCoverage: GetQaCoverageUseCase,
    private readonly getReviewQueue: GetReviewQueueUseCase,
    private readonly getImpactDiff: GetImpactDiffUseCase,
    private readonly getLineage: GetImpactAnalysisLineageUseCase,
    private readonly getAnalysisDriftFreshness: GetAnalysisDriftFreshnessUseCase,
    private readonly getAnalysisWorkspace: GetAnalysisWorkspaceUseCase,
    private readonly permissions: ProjectPermissionService,
  ) {}

  @Get('/multi-repo-runs/:runId/impact-matrix/analyses/:analysisId/details')
  async getMatrixRowDetailEndpoint(
    @Param('runId') runId: string,
    @Param('analysisId') analysisId: string,
    actor: any,
  ) {
    await this.permissions.assertCanReadMultiRepoRun(actor, runId);
    // Extra guard: analysis membership to project is naturally enforced because actor must have access to runId,
    // and the use case itself validates that analysisId belongs to runId.
    const result = await this.getMatrixRowDetail.execute(runId, analysisId);
    return result; // result is already built to schema shape
  }

  @Get('/impact-analyses/:analysisId/lineage')
  async getLineageTimeline(
    @Param('analysisId') analysisId: string,
    actor: any,
  ) {
    
    const lineage = await this.getLineage.execute(analysisId);
    return lineageTimelineResponseSchema.parse(lineage);
  }

  @Get('/impact-analyses/:analysisId/graph')
  async graph(
    @Param('analysisId') analysisId: string,
    actor: any,
  ) {
    
    const result = await this.getImpactGraph.execute(analysisId);
    return impactGraphResponseSchema.parse(result);
  }

  @Get('/impact-analyses/:analysisId/workspace')
  async workspace(
    @Param('analysisId') analysisId: string,
    actor: any,
  ) {
    
    const result = await this.getAnalysisWorkspace.execute(analysisId);
    return analysisWorkspaceResponseSchema.parse(result);
  }

  @Get('/impact-analyses/:analysisId/qa-coverage')
  async qaCoverage(
    @Param('analysisId') analysisId: string,
    actor: any,
  ) {
    
    const result = await this.getQaCoverage.execute(analysisId);
    return qaCoverageResponseSchema.parse(result);
  }

  @Get('/impact-analyses/:analysisId/review-queue')
  async reviewQueue(
    @Param('analysisId') analysisId: string,
    actor: any,
  ) {
    
    const result = await this.getReviewQueue.execute(analysisId);
    return reviewQueueResponseSchema.parse(result);
  }

  @Get('/impact-analyses/:analysisId/diff')
  async diff(
    @Param('analysisId') analysisId: string,
    actor: any,
  ) {
    
    const result = await this.getImpactDiff.execute(analysisId);
    return impactAnalysisDiffResponseSchema.parse(result);
  }

  @Get('/projects/:projectId/analyses/:analysisId/drift-freshness')
  async driftFreshness(
    @Param('projectId') projectId: string,
    @Param('analysisId') analysisId: string,
    actor: any,
  ) {
    
    const result = await this.getAnalysisDriftFreshness.execute(projectId, analysisId);
    return driftFreshnessRecommendationSchema.parse(result);
  }
}
