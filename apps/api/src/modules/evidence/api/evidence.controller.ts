import { Controller, Get, Param } from '@nestjs/common';
import { evidenceListResponseSchema, RequestUser } from '@ba-helper/contracts';
import { ListEvidenceUseCase } from '../application/list-evidence.usecase';
import { mapEvidenceList } from './evidence.mapper';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { ProjectPermissionService } from '../../project/application/project-permission.service';

@Controller('/api/v1')
export class EvidenceController {
  constructor(
    private readonly listEvidence: ListEvidenceUseCase,
    private readonly permissions: ProjectPermissionService,
  ) {}

  @Get('/impact-analyses/:analysisId/evidence')
  async list(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadAnalysis(actor, analysisId);
    const items = await this.listEvidence.execute(analysisId);
    return evidenceListResponseSchema.parse({ items: mapEvidenceList(items) });
  }
}
