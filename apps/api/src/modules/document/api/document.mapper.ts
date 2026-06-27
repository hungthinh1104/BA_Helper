import type { ApprovedImpactReportResponse } from '@ba-helper/contracts';
import type { ApprovedReportMetadata } from '../domain/approved-report-metadata';

export class DocumentMapper {
  static toApprovedReportResponse(
    projectedResult: {
      report: any;
      isStale: boolean;
      staleReason?: string;
      metadata: ApprovedReportMetadata;
      evaluationContext?: any;
      evidenceQualitySummary?: any;
      evidenceQualityItems?: any[];
    }
  ): ApprovedImpactReportResponse {
    const { report, metadata, evaluationContext, evidenceQualitySummary, evidenceQualityItems } = projectedResult;
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
      evaluationContext: evaluationContext || undefined,
      evidenceQualitySummary: evidenceQualitySummary || undefined,
      evidenceQualityItems: evidenceQualityItems || undefined,
      provenance: {
        analysisId: metadata.analysisId,
        projectId: metadata.projectId,
        repositoryId: metadata.repositoryId!,
        targetRef: metadata.targetRef!,
        commitSha: metadata.commitSha!,
        snapshotId: metadata.snapshotId!,
        analyzerVersion: metadata.analyzerVersion!,
        generatedDocumentId: metadata.generatedDocumentId,
        generatedAt: metadata.generatedAt,
        finalizedAt: metadata.finalizedAt,
        approvedDocumentCreatedAt: metadata.approvedDocumentCreatedAt,
        approvedDocumentUpdatedAt: metadata.approvedDocumentUpdatedAt,
        staleStatusAtReadTime: metadata.staleStatusAtReadTime,
      },
    };
  }

  static toReviewedReportSnapshotResponse(snapshot: any) {
    return {
      id: snapshot.id,
      analysisId: snapshot.analysisId,
      approvedDocumentId: snapshot.approvedDocumentId || null,
      markdown: snapshot.markdown,
      reviewDecisionsSnapshot: snapshot.reviewDecisionsSnapshot,
      evidenceQualitySummarySnapshot: snapshot.evidenceQualitySummarySnapshot,
      evaluationContextSnapshot: snapshot.evaluationContextSnapshot || null,
      createdByUserId: snapshot.createdByUserId || null,
      createdAt: snapshot.createdAt.toISOString(),
    };
  }
}
