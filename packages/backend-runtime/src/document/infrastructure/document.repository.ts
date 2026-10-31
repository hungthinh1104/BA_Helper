import { Injectable } from '@nestjs/common';
import { DocumentJobStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { analysisEvidenceScopeWhere } from '../../evidence/infrastructure/analysis-evidence-scope';

@Injectable()
export class DocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async loadApprovedReportContext(analysisId: string, reviewedSnapshotId?: string) {
    const analysis = await this.prisma.impactAnalysis.findUnique({
      where: { id: analysisId },
      include: {
        snapshot: { include: { repository: true, profile: true } },
        sourceTarget: true,
        requirementRevision: true,
      },
    });
    if (!analysis) return null;

    const requestedSnapshot = reviewedSnapshotId
      ? await this.prisma.reviewedReportSnapshot.findFirst({
          where: { id: reviewedSnapshotId, analysisId },
        })
      : null;
    if (reviewedSnapshotId && !requestedSnapshot) {
      return {
        analysis,
        requestedSnapshot,
        reviewedSnapshot: null,
        document: null,
        insights: [],
        traceabilityLinks: [],
        reviewNotes: [],
        clarifications: [],
      };
    }

    const reviewedSnapshot = requestedSnapshot ?? await this.prisma.reviewedReportSnapshot.findFirst({
      where: { analysisId },
      orderBy: { createdAt: 'desc' },
    });
    const document = reviewedSnapshot?.approvedDocumentId
      ? await this.prisma.generatedDocument.findUnique({
          where: { id: reviewedSnapshot.approvedDocumentId },
          select: {
            id: true,
            impactAnalysisId: true,
            reviewedReportSnapshotId: true,
            type: true,
            status: true,
          },
        })
      : reviewedSnapshot
        ? null
        : await this.prisma.generatedDocument.findFirst({
            where: { impactAnalysisId: analysisId, type: 'IMPACT_REPORT', status: 'APPROVED' },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              impactAnalysisId: true,
              reviewedReportSnapshotId: true,
              type: true,
              status: true,
            },
          });

    if (!document || !reviewedSnapshot) {
      return {
        analysis,
        requestedSnapshot,
        reviewedSnapshot,
        document,
        insights: [],
        traceabilityLinks: [],
        reviewNotes: [],
        clarifications: [],
      };
    }

    const [insights, traceabilityLinks, reviewNotes, clarifications] = await Promise.all([
      this.prisma.baInsight.findMany({
        where: { impactAnalysisId: analysisId },
        include: { evidenceLinks: {
          where: { evidence: analysisEvidenceScopeWhere(analysis.snapshotId, analysis.requirementRevisionId) },
          include: { evidence: true },
        } },
      }),
      this.prisma.traceabilityLink.findMany({
        where: { impactAnalysisId: analysisId, artifact: { snapshotId: analysis.snapshotId } },
        include: { artifact: true, evidenceLinks: {
          where: { evidence: analysisEvidenceScopeWhere(analysis.snapshotId, analysis.requirementRevisionId) },
          include: { evidence: true },
        } },
      }),
      this.prisma.reviewNote.findMany({ where: { impactAnalysisId: analysisId } }),
      this.prisma.clarificationItem.findMany({ where: { impactAnalysisId: analysisId } }),
    ]);

    return {
      analysis,
      requestedSnapshot,
      reviewedSnapshot,
      document,
      insights,
      traceabilityLinks,
      reviewNotes,
      clarifications,
    };
  }

  async listByAnalysis(impactAnalysisId: string) {
    return this.prisma.generatedDocument.findMany({
      where: { impactAnalysisId },
      include: {
        impactAnalysis: {
          include: {
            snapshot: true,
            sourceTarget: true,
          },
        },
      },
    });
  }

  async findReviewedReportSnapshotById(analysisId: string, snapshotId: string) {
    return this.prisma.reviewedReportSnapshot.findFirst({
      where: { id: snapshotId, analysisId },
    });
  }

  async findCompletedJobsForApprovedReport(analysisId: string, generatedDocumentId: string) {
    return this.prisma.documentJob.findMany({
      where: { analysisId, generatedDocumentId, status: DocumentJobStatus.COMPLETED },
      select: { snapshotId: true },
    });
  }

  async findGeneratedDocumentById(id: string) {
    return this.prisma.generatedDocument.findUnique({
      where: { id },
      select: {
        id: true,
        impactAnalysisId: true,
        reviewedReportSnapshotId: true,
        type: true,
        status: true,
        content: true,
      },
    });
  }

  async findLatestJobForSnapshot(snapshotId: string) {
    return this.prisma.documentJob.findFirst({
      where: { snapshotId, documentType: 'IMPACT_REPORT' },
      orderBy: { updatedAt: 'desc' },
      include: { generatedDocument: true },
    });
  }

  async findLocalizedReportArtifact(sourceDocumentId: string, locale: string) {
    return this.prisma.localizedReportArtifact.findUnique({
      where: { sourceDocumentId_locale: { sourceDocumentId, locale } },
    });
  }

  async upsertApproved(params: {
    impactAnalysisId: string;
    reviewedReportSnapshotId: string;
    content: string;
    id?: string;
  }, transaction: Prisma.TransactionClient | PrismaService = this.prisma) {
    return transaction.generatedDocument.upsert({
      where: {
        reviewedReportSnapshotId_type_status: {
          reviewedReportSnapshotId: params.reviewedReportSnapshotId,
          type: 'IMPACT_REPORT',
          status: 'APPROVED',
        },
      },
      update: {}, // An existing snapshot generation is immutable; retries only reuse it.
      create: {
        id: params.id,
        impactAnalysisId: params.impactAnalysisId,
        reviewedReportSnapshotId: params.reviewedReportSnapshotId,
        type: 'IMPACT_REPORT',
        status: 'APPROVED',
        content: params.content,
      },
    });
  }

  async findApprovedReportByAnalysisId(impactAnalysisId: string) {
    const latestSnapshot = await this.prisma.reviewedReportSnapshot.findFirst({
      where: { analysisId: impactAnalysisId },
      orderBy: { createdAt: 'desc' },
      select: { approvedDocumentId: true },
    });
    if (latestSnapshot?.approvedDocumentId) {
      return this.prisma.generatedDocument.findUnique({
        where: { id: latestSnapshot.approvedDocumentId },
        include: this.approvedReportInclude(),
      });
    }

    return this.prisma.generatedDocument.findFirst({
      where: { impactAnalysisId, type: 'IMPACT_REPORT', status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      include: this.approvedReportInclude(),
    });
  }

  private approvedReportInclude() {
    return {
      impactAnalysis: {
        include: {
          snapshot: {
            include: {
              repository: true,
            },
          },
          sourceTarget: true,
          requirementRevision: {
            include: {
              requirement: true,
            },
          },
        },
      },
    };
  }
}
