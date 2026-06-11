import { Body, Controller, Param, Post, Get } from '@nestjs/common';
import {
  requirementCreateRequestSchema,
  requirementCreateResponseSchema,
  requirementRevisionCreateRequestSchema,
  requirementRevisionCreateResponseSchema,
  requirementRevisionQualifyResponseSchema,
  requirementListResponseSchema,
  requirementDetailResponseSchema,
  RequestUser,
} from '@ba-helper/contracts';
import { CreateRequirementUseCase } from '../application/create-requirement.usecase';
import { CreateRequirementRevisionUseCase } from '../application/create-revision.usecase';
import { QualifyRequirementRevisionUseCase } from '../application/qualify-revision.usecase';
import { ListRequirementsUseCase } from '../application/list-requirements.usecase';
import { GetRequirementUseCase } from '../application/get-requirement.usecase';

import { Roles } from '../../auth/api/roles.decorator';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { ProjectPermissionService } from '../../project/application/project-permission.service';

@Controller('/api/v1')
export class RequirementController {
  constructor(
    private readonly createRequirement: CreateRequirementUseCase,
    private readonly createRevision: CreateRequirementRevisionUseCase,
    private readonly qualifyRevision: QualifyRequirementRevisionUseCase,
    private readonly listRequirements: ListRequirementsUseCase,
    private readonly getRequirement: GetRequirementUseCase,
    private readonly permissions: ProjectPermissionService,
  ) {}

  @Post('/projects/:projectId/requirements')
  @Roles('ADMIN')
  async createRequirementEndpoint(
    @Param('projectId') projectId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertPermission(
      actor,
      projectId,
      'requirement:create',
      'Project',
    );
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
  @Roles('ADMIN')
  async createRevisionEndpoint(
    @Param('requirementId') requirementId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertPermissionForRequirement(
      actor,
      requirementId,
      'requirement:create',
    );
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
  @Roles('ADMIN')
  async qualifyRevisionEndpoint(
    @Param('revisionId') revisionId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertPermissionForRequirementRevision(
      actor,
      revisionId,
      'requirement:create',
    );
    const result = await this.qualifyRevision.execute({ revisionId });

    return requirementRevisionQualifyResponseSchema.parse({
      revisionId: result.revision.id,
      readinessStatus: result.revision.readinessStatus,
      validationIssues: result.revision.validationIssues ?? [],
    });
  }

  @Get('/projects/:projectId/requirements')
  async listRequirementsEndpoint(
    @Param('projectId') projectId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadProject(actor, projectId);
    const requirements = await this.listRequirements.execute({ projectId });
    return requirementListResponseSchema.parse({
      items: requirements.map((r) => {
        const latest = r.revisions[r.revisions.length - 1];
        return {
          id: r.id,
          latestRevision: {
            id: latest.id,
            versionNumber: r.revisions.length,
            title: latest.title,
            rawText: latest.rawText,
            readinessStatus: latest.readinessStatus,
            validationIssues: latest.validationIssues ?? [],
            createdAt: latest.createdAt.toISOString(),
          },
          canStartAnalysis: latest.readinessStatus === 'READY_FOR_ANALYSIS',
        };
      }),
    });
  }

  @Get('/projects/:projectId/requirements/:requirementId')
  async getRequirementEndpoint(
    @Param('projectId') projectId: string,
    @Param('requirementId') requirementId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadRequirement(
      actor,
      requirementId,
      projectId,
    );
    const r = await this.getRequirement.execute({ requirementId });
    return requirementDetailResponseSchema.parse({
      id: r.id,
      revisions: r.revisions.map((rev: any, index: number) => ({
        id: rev.id,
        versionNumber: index + 1,
        title: rev.title,
        rawText: rev.rawText,
        readinessStatus: rev.readinessStatus,
        validationIssues: rev.validationIssues ?? [],
        createdAt: rev.createdAt.toISOString(),
      })),
    });
  }
}
