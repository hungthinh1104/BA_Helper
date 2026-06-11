import { Body, Controller, Get, Param, Post, Query, BadRequestException, NotFoundException, UseGuards } from '@nestjs/common';
import {
  impactAnalysisCreateRequestSchema,
  impactAnalysisListResponseSchema,
  impactAnalysisResponseSchema,
  multiRepoImpactAnalysisCreateRequestSchema,
  multiRepoImpactAnalysisCreateResponseSchema,
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
  RequestUser,
} from '@ba-helper/contracts';
import { JwtAuthGuard } from '../../auth/application/jwt-auth.guard';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { CreateImpactAnalysisUseCase } from '../application/create-impact-analysis.usecase';
import { CreateMultiRepoImpactAnalysesUseCase } from '../application/create-multi-repo-impact-analyses.usecase';
import { GetImpactAnalysisUseCase } from '../application/get-impact-analysis.usecase';
import { FinalizeImpactAnalysisUseCase } from '../application/finalize-impact-analysis.usecase';
import { ListImpactAnalysesUseCase } from '../application/list-impact-analyses.usecase';
import { GetImpactGraphUseCase } from '../application/get-impact-graph.usecase';
import { GetQaCoverageUseCase } from '../application/get-qa-coverage.usecase';
import { GetReviewQueueUseCase } from '../application/get-review-queue.usecase';
import { GetImpactDiffUseCase } from '../application/get-impact-diff.usecase';
import { CreateAnalysisReviewDecisionUseCase } from '../application/create-analysis-review-decision.usecase';
import { ListReviewDecisionsUseCase } from '../application/list-review-decisions.usecase';
import { GetLatestReviewDecisionUseCase } from '../application/get-latest-review-decision.usecase';
import { GetImpactAnalysisLineageUseCase } from '../application/get-impact-analysis-lineage.usecase';
import {
  mapImpactAnalysisListItem,
  mapImpactAnalysisResponse,
  mapReviewDecision,
} from '../infrastructure/impact-analysis.mapper';

import { Roles } from '../../auth/api/roles.decorator';
import { ProjectPermissionService } from '../../project/application/project-permission.service';

@Controller('/api/v1')
export class ImpactAnalysisController {
  constructor(
    private readonly createAnalysis: CreateImpactAnalysisUseCase,
    private readonly createMultiRepoAnalyses: CreateMultiRepoImpactAnalysesUseCase,
    private readonly getAnalysis: GetImpactAnalysisUseCase,
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
    private readonly permissions: ProjectPermissionService,
  ) {}

  @Post('/requirement-revisions/:revisionId/impact-analyses')
  @Roles('ADMIN')
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
  @Roles('ADMIN')
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
      projectId,
      requirementRevisionId: input.requirementRevisionId,
      repositoryIds: input.repositoryIds,
      requestKey: input.requestKey,
      allowPartialSnapshot: input.allowPartialSnapshot,
    });

    return multiRepoImpactAnalysisCreateResponseSchema.parse(result);
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
  @Roles('ADMIN')
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

  @Post('/impact-analyses/:analysisId/review-decisions')
  @Roles('ADMIN', 'REVIEWER')
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
