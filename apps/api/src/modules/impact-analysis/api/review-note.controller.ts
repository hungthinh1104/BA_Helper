import { Controller, Get, Param, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import {
  createReviewNoteRequestSchema,
  RequestUser,
} from '@ba-helper/contracts';
import { SaveReviewNoteUseCase } from '../application/save-review-note.usecase';
import { GetReviewNotesUseCase } from '../application/get-review-notes.usecase';
import { Roles } from '../../auth/api/roles.decorator';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { ProjectPermissionService } from '../../project/application/project-permission.service';

@Controller('/api/v1/impact-analyses/:analysisId/review-notes')
export class ReviewNoteController {
  constructor(
    private readonly saveNoteUseCase: SaveReviewNoteUseCase,
    private readonly getNotesUseCase: GetReviewNotesUseCase,
    private readonly permissions: ProjectPermissionService,
  ) {}

  @Get()
  async listNotes(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadAnalysis(actor, analysisId);
    return this.getNotesUseCase.execute(analysisId);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'REVIEWER')
  async saveNote(
    @Param('analysisId') analysisId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertPermissionForAnalysis(
      actor,
      analysisId,
      'review:write',
    );
    const input = createReviewNoteRequestSchema.parse(body);
    const note = await this.saveNoteUseCase.execute(analysisId, input);
    return {
      id: note.id,
      impactAnalysisId: note.impactAnalysisId,
      insightId: note.insightId,
      traceabilityLinkId: note.traceabilityLinkId,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    };
  }
}
