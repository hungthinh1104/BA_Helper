import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import {
  CreateClarificationRequestSchema,
  CreateClarificationRequest,
  AnswerClarificationRequestSchema,
  AnswerClarificationRequest,
  DismissClarificationRequestSchema,
  DismissClarificationRequest,
  ClarificationListResponseSchema,
  ClarificationItemDtoSchema,
  ConvertClarificationResponseSchema,
} from '@ba-helper/contracts';
import { EnsureClarificationUseCase } from '../application/ensure-clarification.usecase';
import { AnswerClarificationUseCase } from '../application/answer-clarification.usecase';
import { DismissClarificationUseCase } from '../application/dismiss-clarification.usecase';
import { ListClarificationsUseCase } from '../application/list-clarifications.usecase';
import { ConvertClarificationToRevisionUseCase } from '../application/convert-clarification-to-revision.usecase';
import { ClarificationMapper } from './clarification.mapper';

@Controller('/api/v1')
export class ClarificationController {
  constructor(
    private readonly ensureUseCase: EnsureClarificationUseCase,
    private readonly answerUseCase: AnswerClarificationUseCase,
    private readonly dismissUseCase: DismissClarificationUseCase,
    private readonly listUseCase: ListClarificationsUseCase,
    private readonly convertUseCase: ConvertClarificationToRevisionUseCase,
  ) {}

  @Get('/impact-analyses/:analysisId/clarifications')
  async list(@Param('analysisId') analysisId: string) {
    const items = await this.listUseCase.execute(analysisId);
    return ClarificationListResponseSchema.parse({
      items: ClarificationMapper.toDtoList(items),
    });
  }

  @Post('/impact-analyses/:analysisId/clarifications')
  async create(
    @Param('analysisId') analysisId: string,
    @Body() body: unknown,
  ) {
    const input = CreateClarificationRequestSchema.parse(body);
    const item = await this.ensureUseCase.execute(analysisId, input.sourceInsightId);
    return ClarificationItemDtoSchema.parse(ClarificationMapper.toDto(item));
  }

  @Patch('/clarifications/:id/answer')
  async answer(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = AnswerClarificationRequestSchema.parse(body);
    const item = await this.answerUseCase.execute(id, input.answer);
    return ClarificationItemDtoSchema.parse(ClarificationMapper.toDto(item));
  }

  @Patch('/clarifications/:id/dismiss')
  async dismiss(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = DismissClarificationRequestSchema.parse(body);
    const item = await this.dismissUseCase.execute(id, input.reason);
    return ClarificationItemDtoSchema.parse(ClarificationMapper.toDto(item));
  }

  @Post('/clarifications/:id/convert-to-revision')
  async convertToRevision(@Param('id') id: string) {
    const result = await this.convertUseCase.execute(id);
    return ConvertClarificationResponseSchema.parse(result);
  }
}
