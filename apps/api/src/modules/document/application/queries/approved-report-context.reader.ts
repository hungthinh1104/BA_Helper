import { Injectable, NotFoundException } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { DocumentRepository, MarkdownReportRenderContext, computeCanonicalReportHash } from '@ba-helper/backend-runtime';

export interface ApprovedReportContextResult {
  sourceDocument: { id: string };
  reviewedSnapshot: any;
  canonicalContext: MarkdownReportRenderContext;
  sourceContentHash: string;
}

@Injectable()
export class ApprovedReportContextReader {
  constructor(private readonly documentRepository: DocumentRepository) {}

  async readContext(analysisId: string, reviewedSnapshotId?: string): Promise<ApprovedReportContextResult> {
    const reportData = await this.documentRepository.loadApprovedReportContext(analysisId, reviewedSnapshotId);
    if (!reportData) {
      throw new NotFoundException('Analysis not found');
    }

    if (reviewedSnapshotId && !reportData.requestedSnapshot) {
      throw new NotFoundException('Reviewed snapshot not found for localization context');
    }

    const { analysis, reviewedSnapshot, document } = reportData;

    if (!document) {
      throw new NotFoundException('Approved impact report not found for localization context');
    }
    if (
      document.impactAnalysisId !== analysisId ||
      (document.reviewedReportSnapshotId != null && document.reviewedReportSnapshotId !== reviewedSnapshot?.id) ||
      document.type !== 'IMPACT_REPORT' ||
      document.status !== 'APPROVED'
    ) {
      throw new AppError(
        'REPORT_PROVENANCE_MISMATCH',
        'The reviewed snapshot points to a document outside its approved analysis report.',
        { analysisId, approvedDocumentId: document.id },
      );
    }

    if (!reviewedSnapshot) {
      throw new NotFoundException('Reviewed snapshot missing for approved document');
    }

    const canonicalContext: MarkdownReportRenderContext = {
      analysis: analysis as any,
      locale: 'en',
      insights: reportData.insights as any,
      traceabilityLinks: reportData.traceabilityLinks as any,
      reviewNotes: reportData.reviewNotes,
      hasUnreviewedItems: false,
      dependencyEdges: [],
      clarifications: reportData.clarifications as any,
      reviewDecisions: [],
      reviewDecisionsSnapshot: reviewedSnapshot.reviewDecisionsSnapshot as any,
      evidenceQualitySummarySnapshot: reviewedSnapshot.evidenceQualitySummarySnapshot as any,
    };

    const sourceContentHash = computeCanonicalReportHash(canonicalContext);

    return {
      sourceDocument: document,
      reviewedSnapshot,
      canonicalContext,
      sourceContentHash,
    };
  }
}
