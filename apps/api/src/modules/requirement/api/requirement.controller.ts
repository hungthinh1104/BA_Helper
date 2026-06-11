import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  requirementCreateRequestSchema,
  requirementCreateResponseSchema,
  requirementRevisionCreateRequestSchema,
  requirementRevisionCreateResponseSchema,
  requirementRevisionQualifyResponseSchema,
} from '@ba-helper/contracts';
import { CreateRequirementUseCase } from '../application/create-requirement.usecase';
import { CreateRequirementRevisionUseCase } from '../application/create-revision.usecase';
import { QualifyRequirementRevisionUseCase } from '../application/qualify-revision.usecase';

@Controller('/api/v1')
export class RequirementController {
  constructor(
    private readonly createRequirement: CreateRequirementUseCase,
    private readonly createRevision: CreateRequirementRevisionUseCase,
    private readonly qualifyRevision: QualifyRequirementRevisionUseCase,
  ) {}

  @Post('/projects/:projectId/requirements')
  async createRequirementEndpoint(
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    const input = requirementCreateRequestSchema.parse(body);
    const result = await this.createRequirement.execute({
      projectId,
      title: input.title,
      rawText: input.rawText,
      submitForReadinessCheck: input.submitForReadinessCheck,
    });

    return requirementCreateResponseSchema.parse({
      requirementId: result.requirement.id,
      revisionId: result.revision.id,
      title: result.revision.title,
      readinessStatus: result.revision.readinessStatus,
      validationIssues: result.revision.validationIssues ?? [],
    });
  }

  @Post('/requirements/:requirementId/revisions')
  async createRevisionEndpoint(
    @Param('requirementId') requirementId: string,
    @Body() body: unknown,
  ) {
    const input = requirementRevisionCreateRequestSchema.parse(body);
    const result = await this.createRevision.execute({
      requirementId,
      title: input.title,
      rawText: input.rawText,
      submitForReadinessCheck: input.submitForReadinessCheck,
    });

    return requirementRevisionCreateResponseSchema.parse({
      requirementId: result.requirement.id,
      revisionId: result.revision.id,
      title: result.revision.title,
      readinessStatus: result.revision.readinessStatus,
      validationIssues: result.revision.validationIssues ?? [],
    });
  }

  @Post('/requirement-revisions/:revisionId/qualify')
  async qualifyRevisionEndpoint(@Param('revisionId') revisionId: string) {
    const result = await this.qualifyRevision.execute({ revisionId });

    return requirementRevisionQualifyResponseSchema.parse({
      revisionId: result.revision.id,
      readinessStatus: result.revision.readinessStatus,
      validationIssues: result.revision.validationIssues ?? [],
    });
  }
}
