import { DocumentRepository } from '../infrastructure/document.repository';
import { AppError } from '@ba-helper/shared';
import { ApprovedReportProjectionService } from './approved-report-projection.service';

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
