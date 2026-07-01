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
  type ProjectRole,
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
import { projectRoleHasPermission } from '../../project/application/project-permission.policy';
import { GetImpactDiffUseCase, EventLogService } from "@ba-helper/backend-runtime";

@Controller('/api/v1')
export class MultiRepoAnalysisController {
  constructor(
    private readonly createMultiRepoAnalyses: CreateMultiRepoImpactAnalysesUseCase,
    private readonly getMultiRepoRun: GetMultiRepoAnalysisRunUseCase,
    private readonly getMultiRepoImpactMatrix: BuildMultiRepoImpactMatrixReadModel,
    private readonly getMergedMultiRepoReportDraft: GetMergedMultiRepoReportDraftUseCase,
    private readonly finalizeMultiRepoReport: FinalizeMultiRepoReportUseCase,
    private readonly getApprovedMultiRepoReport: GetApprovedMultiRepoReportUseCase,
    private readonly exportApprovedMultiRepoReport: ExportApprovedMultiRepoReportUseCase,
    private readonly listMultiRepoRuns: ListMultiRepoAnalysisRunsUseCase,
    private readonly createMergedReportReviewDecision: CreateMergedMultiRepoReportReviewDecisionUseCase,
    private readonly listMergedReportReviewDecisions: ListMergedMultiRepoReportReviewDecisionsUseCase,
    private readonly getLatestMergedReportReviewDecision: GetLatestMergedMultiRepoReportReviewDecisionUseCase,
    private readonly permissions: ProjectPermissionService,
  ) {}

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
      domainPackId: input.domainPackId,
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
    const response = mapMultiRepoAnalysisRunDetail(run);
    const role = await this.permissions.getMembershipRole(actor, response.projectId);
    return multiRepoAnalysisRunDetailResponseSchema.parse(
      applyActorMergedReportCapabilities(response, role),
    );
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
    const role = await this.permissions.getMembershipRole(actor, result.projectId);
    return multiRepoApprovedReportResponseSchema.parse(
      applyActorMergedReportCapabilities(result, role),
    );
  }

  @Get('/multi-repo-runs/:runId/merged-report')
  async getApprovedMultiRepoReportEndpoint(
    @Param('runId') runId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadMultiRepoRun(actor, runId);
    const result = await this.getApprovedMultiRepoReport.execute(runId);
    const role = await this.permissions.getMembershipRole(actor, result.projectId);
    return multiRepoApprovedReportResponseSchema.parse(
      applyActorMergedReportCapabilities(result, role),
    );
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
}

function applyActorMergedReportCapabilities<
  T extends {
    projectId: string;
    capabilities: {
      canFinalizeMergedReport: boolean;
      canRefreshMergedReport: boolean;
      canExportMergedReport: boolean;
      canReviewMergedReport: boolean;
      canOpenApprovedReport: boolean;
      blockedReasons: string[];
    };
  },
>(dto: T, role: ProjectRole | null): T {
  const canFinalize = role
    ? projectRoleHasPermission(role, 'analysis:finalize')
    : false;
  const canExport = role ? projectRoleHasPermission(role, 'report:export') : false;
  const canReview = role ? projectRoleHasPermission(role, 'review:write') : false;

  return {
    ...dto,
    capabilities: {
      ...dto.capabilities,
      canFinalizeMergedReport:
        dto.capabilities.canFinalizeMergedReport && canFinalize,
      canRefreshMergedReport:
        dto.capabilities.canRefreshMergedReport && canFinalize,
      canExportMergedReport: dto.capabilities.canExportMergedReport && canExport,
      canReviewMergedReport: dto.capabilities.canReviewMergedReport && canReview,
    },
  };
}
