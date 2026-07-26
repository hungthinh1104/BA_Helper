import { Body, Controller, Param, Put } from '@nestjs/common';
import {
  RequestUser,
  submitReviewItemDecisionRequestSchema,
  submitReviewItemDecisionResponseSchema,
} from '@ba-helper/contracts';
import { SubmitReviewItemDecisionUseCase } from '../application/submit-review-item-decision.usecase';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { ProjectPermissionService } from '../../project/application/project-permission.service';

/**
 * The single mutation surface for review-item decisions. Both impact
 * (traceability) and insight items flow through this target-aware endpoint so
 * the review workbench never has to know which persistence backs an item.
 */
@Controller('/api/v1')
export class ReviewDecisionController {
  constructor(
    private readonly submitDecision: SubmitReviewItemDecisionUseCase,
    private readonly permissions: ProjectPermissionService,
  ) {}

  @Put('/impact-analyses/:analysisId/review-items/:itemId/decision')
  async submit(
    @Param('analysisId') analysisId: string,
    @Param('itemId') itemId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    const input = submitReviewItemDecisionRequestSchema.parse(body);

    if (input.target === 'impact') {
      await this.permissions.assertPermissionForTraceabilityLink(
        actor,
        itemId,
        'review:write',
      );
    } else {
      await this.permissions.assertPermissionForInsight(
        actor,
        itemId,
        'review:write',
      );
    }

    const result = await this.submitDecision.execute({
      analysisId,
      itemId,
      target: input.target,
      action: input.action,
      rationale: input.rationale ?? null,
      actorId: actor.id,
    });

    return submitReviewItemDecisionResponseSchema.parse(result);
  }
}
