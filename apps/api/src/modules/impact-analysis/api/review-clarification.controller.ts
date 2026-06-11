import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  BadRequestException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import {
  reviewClarificationCreateRequestSchema,
  reviewClarificationAnswerRequestSchema,
  reviewClarificationListResponseSchema,
  reviewClarificationRequestSchema,
  impactAnalysisResponseSchema,
  RequestUser,
} from '@ba-helper/contracts';
import { Roles } from '../../auth/api/roles.decorator';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { CreateReviewClarificationRequestUseCase } from '../application/create-review-clarification.usecase';
import { ListReviewClarificationsUseCase } from '../application/list-review-clarifications.usecase';
import { AnswerReviewClarificationUseCase } from '../application/answer-review-clarification.usecase';
import { CreateDerivedAnalysisFromClarificationUseCase } from '../application/create-derived-analysis-from-clarification.usecase';
import { mapImpactAnalysisResponse } from '../infrastructure/impact-analysis.mapper';
import { mapReviewClarificationRequest } from './review-clarification.mapper';

@Controller('/api/v1')
export class ReviewClarificationController {
  constructor(
    private readonly createClarification: CreateReviewClarificationRequestUseCase,
    private readonly listClarifications: ListReviewClarificationsUseCase,
    private readonly answerClarification: AnswerReviewClarificationUseCase,
    private readonly createDerivedAnalysis: CreateDerivedAnalysisFromClarificationUseCase,
  ) {}

  @Post('/impact-analyses/:analysisId/review-clarifications')
  @Roles('ADMIN', 'REVIEWER')
  async create(
    @Param('analysisId') analysisId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    const input = reviewClarificationCreateRequestSchema.parse(body);

    const result = await this.createClarification.execute(analysisId, input, actor);

    return reviewClarificationRequestSchema.parse(mapReviewClarificationRequest(result));
  }

  @Get('/impact-analyses/:analysisId/review-clarifications')
  async listReviewClarifications(
    @Param('analysisId') analysisId: string,
  ) {
    const result = await this.listClarifications.execute(analysisId);
    return reviewClarificationListResponseSchema.parse({
      items: result.items.map(mapReviewClarificationRequest),
    });
  }

  @Post('/review-clarifications/:clarificationId/answer')
  @Roles('ADMIN', 'REVIEWER')
  async answer(
    @Param('clarificationId') clarificationId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    const input = reviewClarificationAnswerRequestSchema.parse(body);

    const result = await this.answerClarification.execute(clarificationId, input.answer, actor);

    return reviewClarificationRequestSchema.parse(mapReviewClarificationRequest(result));
  }

  @Post('/review-clarifications/:clarificationId/derived-analyses')
  @Roles('ADMIN', 'REVIEWER')
  async createDerivedAnalysisFromClarification(
    @Param('clarificationId') clarificationId: string,
  ) {
    const result = await this.createDerivedAnalysis.execute(clarificationId);
    return impactAnalysisResponseSchema.parse(mapImpactAnalysisResponse({ analysis: result }));
  }
}
