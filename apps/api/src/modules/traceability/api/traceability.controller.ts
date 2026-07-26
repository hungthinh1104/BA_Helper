import { Body, Controller, Get, Param, Post, Put, Delete } from '@nestjs/common';
import {
  TraceabilityReviewRequest,
  traceabilityLinkListResponseSchema,
  traceabilityReviewRequestSchema,
  updateTraceabilityReviewDecisionRequestSchema,
  reviewCompletionResponseSchema,
  RequestUser,
} from '@ba-helper/contracts';
import { ListTraceabilityUseCase } from '../application/list-traceability.usecase';
import { GetReviewCompletionUseCase } from '../application/get-review-completion.usecase';
import { ReviewTraceabilityUseCase } from '../application/review-traceability.usecase';
import { UpdateTraceabilityReviewDecisionUseCase } from '../application/update-traceability-review-decision.usecase';
import { DeleteTraceabilityReviewDecisionUseCase } from '../application/delete-traceability-review-decision.usecase';
import { mapTraceabilityList } from './traceability.mapper';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { ProjectPermissionService } from '../../project/application/project-permission.service';

@Controller('/api/v1')
export class TraceabilityController {
  constructor(
    private readonly listTraceability: ListTraceabilityUseCase,
    private readonly reviewTraceability: ReviewTraceabilityUseCase,
    private readonly updateReviewDecisionUseCase: UpdateTraceabilityReviewDecisionUseCase,
    private readonly deleteReviewDecisionUseCase: DeleteTraceabilityReviewDecisionUseCase,
    private readonly getReviewCompletion: GetReviewCompletionUseCase,
    private readonly permissions: ProjectPermissionService,
  ) {}

  @Get('/impact-analyses/:analysisId/traceability')
  async list(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadAnalysis(actor, analysisId);
    const items = await this.listTraceability.execute(analysisId);
    return traceabilityLinkListResponseSchema.parse({
      items: mapTraceabilityList(items),
    });
  }

  @Post('/traceability-links/:linkId/confirm')
  async confirm(
    @Param('linkId') linkId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertPermissionForTraceabilityLink(
      actor,
      linkId,
      'review:write',
    );
    await this.reviewTraceability.execute({ linkId, reviewStatus: 'CONFIRMED' });
    return { ok: true };
  }

  @Post('/traceability-links/:linkId/reject')
  async reject(
    @Param('linkId') linkId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertPermissionForTraceabilityLink(
      actor,
      linkId,
      'review:write',
    );
    await this.reviewTraceability.execute({ linkId, reviewStatus: 'REJECTED' });
    return { ok: true };
  }

  @Post('/traceability-links/:linkId/review')
  async review(
    @Param('linkId') linkId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertPermissionForTraceabilityLink(
      actor,
      linkId,
      'review:write',
    );
    const input = traceabilityReviewRequestSchema.parse(body);
    await this.reviewTraceability.execute({ 
      linkId, 
      reviewStatus: input.reviewStatus,
    });
    return { ok: true };
  }

  @Put('/traceability-links/:linkId/review-decision')
  async updateReviewDecision(
    @Param('linkId') linkId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertPermissionForTraceabilityLink(
      actor,
      linkId,
      'review:write',
    );
    const input = updateTraceabilityReviewDecisionRequestSchema.parse(body);
    await this.updateReviewDecisionUseCase.execute({
      linkId,
      decision: input.decision,
      note: input.note,
      reviewedByUserId: actor.id,
    });
    return { ok: true };
  }

  @Delete('/traceability-links/:linkId/review-decision')
  async deleteReviewDecision(
    @Param('linkId') linkId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertPermissionForTraceabilityLink(
      actor,
      linkId,
      'review:write',
    );
    await this.deleteReviewDecisionUseCase.execute({ linkId });
    return { success: true };
  }

  @Get('/impact-analyses/:analysisId/review-completion')
  async getReviewCompletionGate(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadAnalysis(actor, analysisId);
    
    const result = await this.getReviewCompletion.execute(analysisId);
    
    return reviewCompletionResponseSchema.parse(result);
  }
}
