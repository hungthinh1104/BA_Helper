import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { type RequestUser, testTraceEvidenceResponseSchema } from '@ba-helper/contracts';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { ProjectPermissionService } from '../../project/application/project-permission.service';
import { GetTestTraceEvidenceUseCase } from '../application/qa/get-test-trace-evidence.usecase';

@Controller('/api/v1/impact-analyses')
export class TestTraceEvidenceController {
  constructor(private readonly evidence: GetTestTraceEvidenceUseCase, private readonly permissions: ProjectPermissionService) {}

  @Get('/:analysisId/qa-coverage/evidence/:evidenceId')
  async get(@Param('analysisId') analysisId: string, @Param('evidenceId') evidenceId: string,
    @CurrentUser() actor: RequestUser) {
    await this.permissions.assertCanReadAnalysis(actor, analysisId);
    const result = await this.evidence.execute(analysisId, evidenceId);
    if (!result) throw new NotFoundException('Test trace evidence not found.');
    return testTraceEvidenceResponseSchema.parse(result);
  }
}
