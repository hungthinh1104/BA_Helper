import { Controller, Get, Param } from '@nestjs/common';
import { evidenceListResponseSchema } from '@ba-helper/contracts';
import { ListEvidenceUseCase } from '../application/list-evidence.usecase';
import { mapEvidenceList } from './evidence.mapper';

@Controller('/api/v1')
export class EvidenceController {
  constructor(private readonly listEvidence: ListEvidenceUseCase) {}

  @Get('/impact-analyses/:analysisId/evidence')
  async list(@Param('analysisId') analysisId: string) {
    const items = await this.listEvidence.execute(analysisId);
    return evidenceListResponseSchema.parse({ items: mapEvidenceList(items) });
  }
}
