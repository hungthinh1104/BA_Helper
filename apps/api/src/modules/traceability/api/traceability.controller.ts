import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  traceabilityLinkListResponseSchema,
  traceabilityReviewRequestSchema,
} from '@ba-helper/contracts';
import { ListTraceabilityUseCase } from '../application/list-traceability.usecase';
import { ReviewTraceabilityUseCase } from '../application/review-traceability.usecase';
import { mapTraceabilityList } from './traceability.mapper';

@Controller('/api/v1')
export class TraceabilityController {
  constructor(
    private readonly listTraceability: ListTraceabilityUseCase,
    private readonly reviewTraceability: ReviewTraceabilityUseCase,
  ) {}

  @Get('/impact-analyses/:analysisId/traceability')
  async list(@Param('analysisId') analysisId: string) {
    const items = await this.listTraceability.execute(analysisId);
    return traceabilityLinkListResponseSchema.parse({
      items: mapTraceabilityList(items),
    });
  }

  @Post('/traceability-links/:linkId/confirm')
  async confirm(@Param('linkId') linkId: string) {
    await this.reviewTraceability.execute({ linkId, reviewStatus: 'CONFIRMED' });
    return { ok: true };
  }

  @Post('/traceability-links/:linkId/reject')
  async reject(@Param('linkId') linkId: string) {
    await this.reviewTraceability.execute({ linkId, reviewStatus: 'REJECTED' });
    return { ok: true };
  }

  @Post('/traceability-links/:linkId/review')
  async review(@Param('linkId') linkId: string, @Body() body: unknown) {
    const input = traceabilityReviewRequestSchema.parse(body);
    await this.reviewTraceability.execute({
      linkId,
      reviewStatus: input.reviewStatus,
    });
    return { ok: true };
  }
}
