import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  insightListResponseSchema,
  insightReviewRequestSchema,
} from '@ba-helper/contracts';
import { ListInsightsUseCase } from '../application/list-insights.usecase';
import { ReviewInsightUseCase } from '../application/review-insight.usecase';
import { mapInsightList } from './insight.mapper';

@Controller('/api/v1')
export class InsightController {
  constructor(
    private readonly listInsights: ListInsightsUseCase,
    private readonly reviewInsight: ReviewInsightUseCase,
  ) {}

  @Get('/impact-analyses/:analysisId/insights')
  async list(@Param('analysisId') analysisId: string) {
    const items = await this.listInsights.execute(analysisId);
    return insightListResponseSchema.parse({ items: mapInsightList(items) });
  }

  @Post('/insights/:insightId/confirm')
  async confirm(@Param('insightId') insightId: string) {
    await this.reviewInsight.execute({ insightId, reviewStatus: 'CONFIRMED' });
    return { ok: true };
  }

  @Post('/insights/:insightId/reject')
  async reject(@Param('insightId') insightId: string) {
    await this.reviewInsight.execute({ insightId, reviewStatus: 'REJECTED' });
    return { ok: true };
  }

  @Post('/insights/:insightId/review')
  async review(@Param('insightId') insightId: string, @Body() body: unknown) {
    const input = insightReviewRequestSchema.parse(body);
    await this.reviewInsight.execute({
      insightId,
      reviewStatus: input.reviewStatus,
    });
    return { ok: true };
  }
}
