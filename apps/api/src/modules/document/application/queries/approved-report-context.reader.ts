import { Injectable, NotFoundException } from '@nestjs/common';
import { MarkdownReportRenderContext, computeCanonicalReportHash, PrismaService } from '@ba-helper/backend-runtime';
import { GeneratedDocument } from '@prisma/client';

export interface ApprovedReportContextResult {
  sourceDocument: GeneratedDocument;
  reviewedSnapshot: any;
  canonicalContext: MarkdownReportRenderContext;
  sourceContentHash: string;
}

@Injectable()
export class ApprovedReportContextReader {
  constructor(private readonly prisma: PrismaService) {}

  async readContext(analysisId: string): Promise<ApprovedReportContextResult> {
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

    const document = await this.prisma.generatedDocument.findFirst({
      where: {
        impactAnalysisId: analysisId,
        type: 'IMPACT_REPORT',
        status: 'APPROVED',
      }
    });

    if (!document) {
      throw new NotFoundException('Approved impact report not found for localization context');
    }

    const reviewedSnapshot = await this.prisma.reviewedReportSnapshot.findFirst({
      where: { approvedDocumentId: document.id }
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
