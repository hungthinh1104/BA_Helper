import { Injectable, NotFoundException } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { MarkdownReportRenderContext, computeCanonicalReportHash, PrismaService } from '@ba-helper/backend-runtime';
import { GeneratedDocument } from '@prisma/client';

export interface ApprovedReportContextResult {
  sourceDocument: Pick<GeneratedDocument, 'id'>;
  reviewedSnapshot: any;
  canonicalContext: MarkdownReportRenderContext;
  sourceContentHash: string;
}

@Injectable()
export class ApprovedReportContextReader {
  constructor(private readonly prisma: PrismaService) {}

  async readContext(analysisId: string, reviewedSnapshotId?: string): Promise<ApprovedReportContextResult> {
    const analysis = await this.prisma.impactAnalysis.findUnique({
      where: { id: analysisId },
      include: {
        snapshot: { include: { repository: true, profile: true } },
        sourceTarget: true,
        requirementRevision: true,
      }
    });

    if (!analysis) {
      throw new NotFoundException('Analysis not found');
    }

    const requestedSnapshot = reviewedSnapshotId
      ? await this.prisma.reviewedReportSnapshot.findFirst({
          where: { id: reviewedSnapshotId, analysisId },
        })
      : null;
    if (reviewedSnapshotId && !requestedSnapshot) {
      throw new NotFoundException('Reviewed snapshot not found for localization context');
    }

    const document = requestedSnapshot?.approvedDocumentId
      ? await this.prisma.generatedDocument.findUnique({
          where: { id: requestedSnapshot.approvedDocumentId },
          select: { id: true, impactAnalysisId: true, type: true, status: true },
        })
      : reviewedSnapshotId
        ? null
        : await this.prisma.generatedDocument.findUnique({
            where: {
              impactAnalysisId_type_status: {
                impactAnalysisId: analysisId,
                type: 'IMPACT_REPORT',
                status: 'APPROVED',
              },
            },
            select: { id: true, impactAnalysisId: true, type: true, status: true },
          });

    if (!document) {
      throw new NotFoundException('Approved impact report not found for localization context');
    }
    if (
      document.impactAnalysisId !== analysisId ||
      document.type !== 'IMPACT_REPORT' ||
      document.status !== 'APPROVED'
    ) {
      throw new AppError(
        'REPORT_PROVENANCE_MISMATCH',
        'The reviewed snapshot points to a document outside its approved analysis report.',
        { analysisId, approvedDocumentId: document.id },
      );
    }

    const reviewedSnapshot = requestedSnapshot ?? await this.prisma.reviewedReportSnapshot.findFirst({
      where: { analysisId, approvedDocumentId: document.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!reviewedSnapshot) {
      throw new NotFoundException('Reviewed snapshot missing for approved document');
    }

    const insights = await this.prisma.baInsight.findMany({
      where: { impactAnalysisId: analysisId },
      include: { evidenceLinks: { include: { evidence: true } } }
    });

    const traceabilityLinks = await this.prisma.traceabilityLink.findMany({
      where: { impactAnalysisId: analysisId },
      include: { artifact: true, evidenceLinks: { include: { evidence: true } } }
    });

    const reviewNotes = await this.prisma.reviewNote.findMany({
      where: { impactAnalysisId: analysisId }
    });

    const clarifications = await this.prisma.clarificationItem.findMany({
      where: { impactAnalysisId: analysisId }
    });

    const canonicalContext: MarkdownReportRenderContext = {
      analysis: analysis as any,
      locale: 'en',
      insights: insights as any,
      traceabilityLinks: traceabilityLinks as any,
      reviewNotes,
      hasUnreviewedItems: false,
      dependencyEdges: [],
      clarifications: clarifications as any,
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
