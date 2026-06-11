import { DocumentRepository } from '../infrastructure/document.repository';
import { AppError } from '../../../shared/app-error';

export class GetApprovedReportUseCase {
  constructor(private readonly repository: DocumentRepository) {}

  async execute(analysisId: string) {
    const report = await this.repository.findApprovedReportByAnalysisId(analysisId);
    
    if (!report) {
      throw new AppError('APPROVED_REPORT_NOT_FOUND', 'Approved impact report not found.');
    }

    const analysis = report.impactAnalysis;
    const isPinnedCommit = analysis.sourceTarget.resolvedRefType === 'COMMIT';
    
    const isStale =
      !isPinnedCommit &&
      !!analysis.sourceTarget.latestObservedCommitSha &&
      analysis.sourceTarget.latestObservedCommitSha !== analysis.snapshot.commitSha;

    const staleReason = isStale
      ? 'Source target has advanced to a newer commit since analysis.'
      : undefined;

    return {
      report,
      isStale,
      staleReason,
    };
  }
}
