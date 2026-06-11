import { ApprovedImpactReportResponse } from '@ba-helper/contracts';
import { ApprovedReportMetadata } from '../domain/approved-report-metadata';

export class DocumentMapper {
  static toApprovedReportResponse(
    report: any,
    metadata: ApprovedReportMetadata,
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
      isStale: metadata.staleStatusAtReadTime,
      staleReason: metadata.staleReason,
      provenance: {
        analysisId: metadata.analysisId,
        projectId: metadata.projectId,
        repositoryId: metadata.repositoryId,
        targetRef: metadata.targetRef,
        commitSha: metadata.commitSha,
        snapshotId: metadata.snapshotId,
        analyzerVersion: metadata.analyzerVersion,
        generatedDocumentId: metadata.generatedDocumentId,
        generatedAt: metadata.generatedAt,
        finalizedAt: metadata.finalizedAt,
        staleStatusAtReadTime: metadata.staleStatusAtReadTime,
      },
    };
  }
}
