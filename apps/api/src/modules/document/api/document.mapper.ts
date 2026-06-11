import { ApprovedImpactReportResponse } from '@ba-helper/contracts';

export class DocumentMapper {
  static toApprovedReportResponse(
    report: any,
    isStale: boolean,
    staleReason?: string,
  ): ApprovedImpactReportResponse {
    const analysis = report.impactAnalysis;
    const revision = analysis.requirementRevision;

    return {
      id: report.id,
      impactAnalysisId: report.impactAnalysisId,
      requirementRevisionId: revision.id,
      snapshotId: analysis.snapshotId,
      sourceTargetId: analysis.sourceTargetId || undefined,
      type: 'IMPACT_REPORT',
      status: 'APPROVED',
      format: 'MARKDOWN',
      title: revision.title,
      markdown: report.content,
      isStale,
      staleReason,
      provenance: {
        commitSha: analysis.snapshot.commitSha,
        analyzerVersion: analysis.snapshot.analyzerVersion,
        generatedAt: report.createdAt.toISOString(),
        finalizedAt: report.updatedAt.toISOString(),
      },
    };
  }
}
