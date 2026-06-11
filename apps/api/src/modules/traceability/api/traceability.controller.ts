import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  traceabilityLinkListResponseSchema,
  traceabilityReviewRequestSchema,
  RequestUser,
} from '@ba-helper/contracts';
import { ListTraceabilityUseCase } from '../application/list-traceability.usecase';
import { ReviewTraceabilityUseCase } from '../application/review-traceability.usecase';
import { mapTraceabilityList } from './traceability.mapper';
import { Roles } from '../../auth/api/roles.decorator';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { ProjectPermissionService } from '../../project/application/project-permission.service';

@Controller('/api/v1')
export class TraceabilityController {
  constructor(
    private readonly listTraceability: ListTraceabilityUseCase,
    private readonly reviewTraceability: ReviewTraceabilityUseCase,
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
  @Roles('ADMIN', 'REVIEWER')
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
  @Roles('ADMIN', 'REVIEWER')
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
  @Roles('ADMIN', 'REVIEWER')
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
}
