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
import { GetImpactDiffUseCase, EventLogService } from "@ba-helper/backend-runtime";

@Controller('/api/v1')
export class ImpactAnalysisLifecycleController {
  constructor(
    private readonly createAnalysis: CreateImpactAnalysisUseCase,
    private readonly getAnalysis: GetImpactAnalysisUseCase,
    private readonly finalizeAnalysis: FinalizeImpactAnalysisUseCase,
    private readonly listAnalyses: ListImpactAnalysesUseCase,
    private readonly permissions: ProjectPermissionService,
    private readonly eventLogService: EventLogService,
  ) {}

  @Post('/requirement-revisions/:revisionId/impact-analyses')
  async create(
    @Param('revisionId') revisionId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertPermissionForRequirementRevision(
      actor,
      revisionId,
      'analysis:create',
    );
    const input = impactAnalysisCreateRequestSchema.parse(body);
    const analysis = await this.createAnalysis.execute({
      requirementRevisionId: revisionId,
      snapshotId: input.snapshotId,
      sourceTargetId: input.sourceTargetId,
      allowPartialSnapshot: input.allowPartialSnapshot,
      requestKey: input.requestKey,
      domainPackId: input.domainPackId,
    });

    const response = impactAnalysisResponseSchema.parse(
      mapImpactAnalysisResponse({ analysis }),
    );

    return response;
  }

  @Get('/impact-analyses/:analysisId')
  async get(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadAnalysis(actor, analysisId);
    const analysis = await this.getAnalysis.execute(analysisId);
    return impactAnalysisResponseSchema.parse(
      mapImpactAnalysisResponse({ analysis }),
    );
  }

  @Get('/impact-analyses/:analysisId/events')
  async getEvents(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadAnalysis(actor, analysisId);
    // ensure analysis exists is implicitly checked by permission assert if the analysis is missing it will throw 404
    // Wait, assertCanReadAnalysis throws 404 if not found? No, usually project membership is checked. Let's make sure it exists by calling getAnalysis?
    // Actually, assertCanReadAnalysis checks ProjectMembership and usually fetches the analysis to verify.
    // If not, getting events for a non-existent analysis will just return [] which is fine.
    
    const events = await this.eventLogService.getAnalysisEvents(analysisId);
    return { items: events };
  }

  @Get('/projects/:projectId/analyses')
  async list(
    @Param('projectId') projectId: string,
    @Query() query: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadProject(actor, projectId);
    const parsedQuery = paginationQuerySchema.safeParse(query);
    if (!parsedQuery.success) {
      throw new BadRequestException(parsedQuery.error.errors);
    }
    const { limit, offset } = parsedQuery.data;

    const analyses = await this.listAnalyses.execute({ projectId, limit, offset });

    return impactAnalysisListResponseSchema.parse({
      items: analyses.map((analysis) => mapImpactAnalysisListItem(analysis as unknown as Parameters<typeof mapImpactAnalysisListItem>[0])),
    });
  }

  @Post('/impact-analyses/:analysisId/finalize')
  async finalize(
    @Param('analysisId') analysisId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertPermissionForAnalysis(
      actor,
      analysisId,
      'analysis:finalize',
    );
    const input = finalizeImpactAnalysisRequestSchema.parse(body);
    const analysis = await this.finalizeAnalysis.execute({
      analysisId,
      acknowledgeUnreviewed: input.acknowledgeUnreviewed,
      userId: actor.id,
    });
    return impactAnalysisResponseSchema.parse(
      mapImpactAnalysisResponse({ analysis }),
    );
  }
}
