import { AppError } from '@ba-helper/shared';
import type { ApprovedReportProjectionService } from './approved-report-projection.service';
import { DocumentRepository } from "@ba-helper/backend-runtime";

export class GetApprovedReportUseCase {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly projectionService: ApprovedReportProjectionService,
  ) {}

  async execute(analysisId: string) {
    const report = await this.repository.findApprovedReportByAnalysisId(analysisId);
    
    if (!report) {
      throw new AppError('APPROVED_REPORT_NOT_FOUND', 'Approved impact report not found.');
    }

    return this.projectionService.project(report);
  }
}
