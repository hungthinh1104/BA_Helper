import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  insightListResponseSchema,
  insightReviewRequestSchema,
  RequestUser,
} from '@ba-helper/contracts';
import { ListInsightsUseCase } from '../application/list-insights.usecase';
import { ReviewInsightUseCase } from '../application/review-insight.usecase';
import { mapInsightList } from './insight.mapper';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { ProjectPermissionService } from '../../project/application/project-permission.service';

@Controller('/api/v1')
export class InsightController {
  constructor(
    private readonly listInsights: ListInsightsUseCase,
    private readonly reviewInsight: ReviewInsightUseCase,
    private readonly permissions: ProjectPermissionService,
  ) {}

  @Get('/impact-analyses/:analysisId/insights')
  async list(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadAnalysis(actor, analysisId);
    const items = await this.listInsights.execute(analysisId);
    return insightListResponseSchema.parse({ items: mapInsightList(items) });
  }

  @Post('/insights/:insightId/confirm')
  async confirm(
    @Param('insightId') insightId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertPermissionForInsight(
      actor,
      insightId,
      'review:write',
    );
    await this.reviewInsight.execute({ insightId, reviewStatus: 'CONFIRMED' });
    return { ok: true };
  }

  @Post('/insights/:insightId/reject')
  async reject(
    @Param('insightId') insightId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertPermissionForInsight(
      actor,
      insightId,
      'review:write',
    );
    await this.reviewInsight.execute({ insightId, reviewStatus: 'REJECTED' });
    return { ok: true };
  }

  @Post('/insights/:insightId/review')
  async review(
    @Param('insightId') insightId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertPermissionForInsight(
      actor,
      insightId,
      'review:write',
    );
    const input = insightReviewRequestSchema.parse(body);
    await this.reviewInsight.execute({
      insightId,
      reviewStatus: input.reviewStatus,
    });
    return { ok: true };
  }
}
