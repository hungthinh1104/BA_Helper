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

@Controller('/api/v1')
export class ImpactAnalysisController {
  constructor(
    private readonly createAnalysis: CreateImpactAnalysisUseCase,
    private readonly createMultiRepoAnalyses: CreateMultiRepoImpactAnalysesUseCase,
    private readonly getAnalysis: GetImpactAnalysisUseCase,
    private readonly getMultiRepoRun: GetMultiRepoAnalysisRunUseCase,
    private readonly getMultiRepoImpactMatrix: BuildMultiRepoImpactMatrixReadModel,
    private readonly getMatrixRowDetail: GetMatrixRowDetailUseCase,
    private readonly getMergedMultiRepoReportDraft: GetMergedMultiRepoReportDraftUseCase,
    private readonly finalizeMultiRepoReport: FinalizeMultiRepoReportUseCase,
    private readonly getApprovedMultiRepoReport: GetApprovedMultiRepoReportUseCase,
    private readonly exportApprovedMultiRepoReport: ExportApprovedMultiRepoReportUseCase,
    private readonly listMultiRepoRuns: ListMultiRepoAnalysisRunsUseCase,
    private readonly createMergedReportReviewDecision: CreateMergedMultiRepoReportReviewDecisionUseCase,
    private readonly listMergedReportReviewDecisions: ListMergedMultiRepoReportReviewDecisionsUseCase,
    private readonly getLatestMergedReportReviewDecision: GetLatestMergedMultiRepoReportReviewDecisionUseCase,
    private readonly finalizeAnalysis: FinalizeImpactAnalysisUseCase,
    private readonly listAnalyses: ListImpactAnalysesUseCase,
    private readonly getImpactGraph: GetImpactGraphUseCase,
    private readonly getQaCoverage: GetQaCoverageUseCase,
    private readonly getReviewQueue: GetReviewQueueUseCase,
    private readonly getImpactDiff: GetImpactDiffUseCase,
    private readonly createReviewDecision: CreateAnalysisReviewDecisionUseCase,
    private readonly listReviewDecisions: ListReviewDecisionsUseCase,
    private readonly getLatestReviewDecision: GetLatestReviewDecisionUseCase,
    private readonly getLineage: GetImpactAnalysisLineageUseCase,
    private readonly getReviewCoverage: GetReviewCoverageUseCase,
    private readonly getAnalysisDriftFreshness: GetAnalysisDriftFreshnessUseCase,
    private readonly permissions: ProjectPermissionService,
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
    });

    const response = impactAnalysisResponseSchema.parse(
      mapImpactAnalysisResponse({ analysis }),
    );

    return response;
  }

  @Post('/projects/:projectId/multi-repo-analyses')
  async createMultiRepo(
    @Param('projectId') projectId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertPermission(
      actor,
      projectId,
      'analysis:create',
      'Project',
    );
    const input = multiRepoImpactAnalysisCreateRequestSchema.parse(body);
    const result = await this.createMultiRepoAnalyses.execute({
      actorId: actor.id,
      projectId,
      requirementRevisionId: input.requirementRevisionId,
      repositoryIds: input.repositoryIds,
      requestKey: input.requestKey,
      allowPartialSnapshot: input.allowPartialSnapshot,
    });

    return multiRepoImpactAnalysisCreateResponseSchema.parse(result);
  }

  @Get('/multi-repo-runs/:runId')
  async getMultiRepoRunDetail(
    @Param('runId') runId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadMultiRepoRun(actor, runId);
    const run = await this.getMultiRepoRun.execute(runId);
    return multiRepoAnalysisRunDetailResponseSchema.parse(
      mapMultiRepoAnalysisRunDetail(run),
    );
  }

  @Get('/multi-repo-runs/:runId/review-coverage')
  async getReviewCoverageEndpoint(
    @Param('runId') runId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    // Permission is checked within the use case
    const result = await this.getReviewCoverage.execute(actor, runId);
    return result; // result is already validated by contract schema format implicitly, or we can use reviewCoverageResponseSchema.parse
  }

  @Get('/multi-repo-runs/:runId/impact-matrix')
  async getMultiRepoRunImpactMatrix(
    @Param('runId') runId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadMultiRepoRun(actor, runId);
    const result = await this.getMultiRepoImpactMatrix.execute(runId);
    return multiRepoImpactMatrixResponseSchema.parse(result);
  }

  @Get('/multi-repo-runs/:runId/impact-matrix/analyses/:analysisId/details')
  async getMatrixRowDetailEndpoint(
    @Param('runId') runId: string,
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadMultiRepoRun(actor, runId);
    // Extra guard: analysis membership to project is naturally enforced because actor must have access to runId,
    // and the use case itself validates that analysisId belongs to runId.
    const result = await this.getMatrixRowDetail.execute(runId, analysisId);
    return result; // result is already built to schema shape
  }

  @Get('/multi-repo-runs/:runId/merged-report-draft')
  async getMergedMultiRepoReportDraftEndpoint(
    @Param('runId') runId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadMultiRepoRun(actor, runId);
    const result = await this.getMergedMultiRepoReportDraft.execute(runId, actor);
    return multiRepoMergedReportDraftResponseSchema.parse(result);
  }

  @Post('/multi-repo-runs/:runId/merged-report/finalize')
  async finalizeMergedMultiRepoReportEndpoint(
    @Param('runId') runId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertPermissionForMultiRepoRun(
      actor,
      runId,
      'analysis:finalize',
    );
    const result = await this.finalizeMultiRepoReport.execute(runId, actor);
    return multiRepoApprovedReportResponseSchema.parse(result);
  }

  @Get('/multi-repo-runs/:runId/merged-report')
  async getApprovedMultiRepoReportEndpoint(
    @Param('runId') runId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadMultiRepoRun(actor, runId);
    const result = await this.getApprovedMultiRepoReport.execute(runId);
    return multiRepoApprovedReportResponseSchema.parse(result);
  }

  @Post('/multi-repo-runs/:runId/merged-report/review-decisions')
  async createMergedMultiRepoReportReviewDecisionEndpoint(
    @Param('runId') runId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertPermissionForMultiRepoRun(
      actor,
      runId,
      'review:write',
    );
    const input = reviewDecisionRequestSchema.parse(body);
    const result = await this.createMergedReportReviewDecision.execute({
      runId,
      decision: input.decision,
      note: input.note,
      reviewedByUserId: actor.id,
    });

    return mergedMultiRepoReportReviewDecisionCreateResponseSchema.parse({
      decision: mapMergedMultiRepoReportReviewDecision(result.decision),
    });
  }

  @Get('/multi-repo-runs/:runId/merged-report/review-decisions')
  async listMergedMultiRepoReportReviewDecisionsEndpoint(
    @Param('runId') runId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadMultiRepoRun(actor, runId);
    const result = await this.listMergedReportReviewDecisions.execute(runId);
    return mergedMultiRepoReportReviewDecisionListResponseSchema.parse({
      items: result.items.map((decision) =>
        mapMergedMultiRepoReportReviewDecision(decision),
      ),
    });
  }

  @Get('/multi-repo-runs/:runId/merged-report/review-decisions/latest')
  async getLatestMergedMultiRepoReportReviewDecisionEndpoint(
    @Param('runId') runId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadMultiRepoRun(actor, runId);
    const decision = await this.getLatestMergedReportReviewDecision.execute(runId);
    if (!decision) {
      throw new NotFoundException('Merged multi-repo report review decision not found.');
    }

    return mergedMultiRepoReportReviewDecisionResponseSchema.parse(
      mapMergedMultiRepoReportReviewDecision(decision),
    );
  }

  @Get('/multi-repo-runs/:runId/merged-report/export.md')
  async exportApprovedMultiRepoReportMarkdownEndpoint(
    @Param('runId') runId: string,
    @CurrentUser() actor: RequestUser,
    @Res() res: any,
  ) {
    await this.permissions.assertPermissionForMultiRepoRun(
      actor,
      runId,
      'report:export',
    );
    const result = await this.exportApprovedMultiRepoReport.execute({
      runId,
      actor,
      format: 'markdown',
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  }

  @Get('/multi-repo-runs/:runId/merged-report/export.pdf')
  async exportApprovedMultiRepoReportPdfEndpoint(
    @Param('runId') runId: string,
    @CurrentUser() actor: RequestUser,
    @Res() res: any,
  ) {
    await this.permissions.assertPermissionForMultiRepoRun(
      actor,
      runId,
      'report:export',
    );
    const result = await this.exportApprovedMultiRepoReport.execute({
      runId,
      actor,
      format: 'pdf',
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  }

  @Get('/projects/:projectId/multi-repo-runs')
  async listMultiRepoRunsByProject(
    @Param('projectId') projectId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadProject(actor, projectId);
    const runs = await this.listMultiRepoRuns.execute(projectId);
    return multiRepoAnalysisRunListResponseSchema.parse({
      items: runs.map((run) => mapMultiRepoAnalysisRunListItem(run)),
    });
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

  @Get('/impact-analyses/:analysisId/lineage')
  async getLineageTimeline(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadAnalysis(actor, analysisId);
    const lineage = await this.getLineage.execute(analysisId);
    return lineageTimelineResponseSchema.parse(lineage);
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
    });
    return impactAnalysisResponseSchema.parse(
      mapImpactAnalysisResponse({ analysis }),
    );
  }

  @Get('/impact-analyses/:analysisId/graph')
  async graph(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadAnalysis(actor, analysisId);
    const result = await this.getImpactGraph.execute(analysisId);
    return impactGraphResponseSchema.parse(result);
  }

  @Get('/impact-analyses/:analysisId/qa-coverage')
  async qaCoverage(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadAnalysis(actor, analysisId);
    const result = await this.getQaCoverage.execute(analysisId);
    return qaCoverageResponseSchema.parse(result);
  }

  @Get('/impact-analyses/:analysisId/review-queue')
  async reviewQueue(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadAnalysis(actor, analysisId);
    const result = await this.getReviewQueue.execute(analysisId);
    return reviewQueueResponseSchema.parse(result);
  }

  @Get('/impact-analyses/:analysisId/diff')
  async diff(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadAnalysis(actor, analysisId);
    const result = await this.getImpactDiff.execute(analysisId);
    return impactAnalysisDiffResponseSchema.parse(result);
  }

  @Get('/projects/:projectId/analyses/:analysisId/drift-freshness')
  async driftFreshness(
    @Param('projectId') projectId: string,
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadAnalysis(actor, analysisId);
    const result = await this.getAnalysisDriftFreshness.execute(projectId, analysisId);
    return driftFreshnessRecommendationSchema.parse(result);
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
