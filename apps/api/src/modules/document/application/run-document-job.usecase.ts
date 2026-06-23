import { Injectable } from '@nestjs/common';
import { DocumentJobStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MarkdownImpactReportBuilder } from './markdown-impact-report.builder';
import { InsightRepository } from '../../insight/infrastructure/insight.repository';
import { TraceabilityRepository } from '../../traceability/infrastructure/traceability.repository';
import { ReviewNoteRepository } from '../../impact-analysis/infrastructure/review-note.repository';
import { GraphRepository } from '../../graph/infrastructure/graph.repository';
import { ClarificationRepository } from '../../clarification/infrastructure/clarification.repository';
import { ReviewDecisionRepository } from '../../impact-analysis/infrastructure/review-decision.repository';
import { GetImpactDiffUseCase } from '../../impact-analysis/application/queries/get-impact-diff.usecase';
import { DocumentRepository } from '../infrastructure/document.repository';
import { AppError } from '../../../shared/app-error';

@Injectable()
export class RunDocumentJobUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportBuilder: MarkdownImpactReportBuilder,
    private readonly insightRepo: InsightRepository,
    private readonly traceabilityRepo: TraceabilityRepository,
    private readonly reviewNoteRepo: ReviewNoteRepository,
    private readonly graphRepo: GraphRepository,
    private readonly clarificationRepo: ClarificationRepository,
    private readonly decisionRepo: ReviewDecisionRepository,
    private readonly getDiffUseCase: GetImpactDiffUseCase,
    private readonly documentRepo: DocumentRepository,
  ) {}

  async execute(params: { documentJobId: string }) {
    const docJob = await this.markRunning(params.documentJobId);

    try {
      const snapshot = await this.prisma.reviewedReportSnapshot.findUnique({
        where: { id: docJob.snapshotId },
      });
      if (!snapshot) {
        throw new AppError('SNAPSHOT_NOT_FOUND', 'Reviewed report snapshot not found.');
      }

      const analysis = await this.prisma.impactAnalysis.findUnique({
        where: { id: snapshot.analysisId },
        include: {
          snapshot: { include: { repository: true } },
          sourceTarget: true,
          requirementRevision: { include: { requirement: true } },
          insights: true,
        },
      });
      if (!analysis) {
        throw new AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Impact analysis not found.');
      }

      const markdown = await this.buildMarkdown(analysis);
      const persistedReport = await this.documentRepo.upsertApproved({
        impactAnalysisId: analysis.id,
        content: markdown,
      });

      await this.prisma.$transaction(async (tx) => {
        await tx.documentJob.update({
          where: { id: docJob.id },
          data: {
            status: DocumentJobStatus.COMPLETED,
            progress: 100,
            completedAt: new Date(),
            generatedDocumentId: persistedReport.id,
          },
        });

        await tx.reviewedReportSnapshot.update({
          where: { id: snapshot.id },
          data: { approvedDocumentId: persistedReport.id },
        });
      });

      return { success: true, generatedDocumentId: persistedReport.id };
    } catch (error) {
      await this.prisma.documentJob.update({
        where: { id: docJob.id },
        data: {
          status: DocumentJobStatus.FAILED,
          error: this.toErrorJson(error),
          failedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async markRunning(documentJobId: string) {
    const job = await this.prisma.documentJob.findUnique({
      where: { id: documentJobId },
    });

    if (!job) {
      throw new AppError('DOCUMENT_JOB_NOT_FOUND', 'Document job not found.');
    }

    if (job.status !== DocumentJobStatus.QUEUED && job.status !== DocumentJobStatus.RUNNING) {
      throw new AppError('DOCUMENT_JOB_NOT_READY', 'Document job is not queued or running.', {
        status: job.status,
      });
    }

    return this.prisma.documentJob.update({
      where: { id: documentJobId },
      data: {
        status: DocumentJobStatus.RUNNING,
        lastStartedAt: new Date(),
      },
    });
  }

  private async buildMarkdown(analysis: any) {
    const analysisId = analysis.id;
    const insights = await this.insightRepo.listByAnalysis(analysisId);
    const traceabilityLinks = await this.traceabilityRepo.listByAnalysis(analysisId);
    const reviewNotes = await this.reviewNoteRepo.findByAnalysisId(analysisId);
    const dependencyEdges = await this.graphRepo.listBySnapshot(analysis.snapshot.id);
    const clarifications = await this.clarificationRepo.listByAnalysisId(analysisId);
    const reviewDecisions = await this.decisionRepo.listByAnalysisId(analysisId);

    let diff: any = undefined;
    if (analysis.derivedFromAnalysisId) {
      const diffResult = await this.getDiffUseCase.computeForAnalysis(analysisId);
      if (diffResult.computable) {
        diff = diffResult.diff;
      }
    }

    const hasUnreviewed = analysis.insights?.some(
      (insight: { reviewStatus: string }) => insight.reviewStatus === 'NEEDS_REVIEW',
    );

    return this.reportBuilder.build({
      analysis,
      insights,
      traceabilityLinks: traceabilityLinks as any[],
      reviewNotes,
      hasUnreviewedItems: !!hasUnreviewed,
      dependencyEdges: dependencyEdges as any[],
      clarifications: clarifications as any[],
      reviewDecisions,
      diff,
      metadata: {
        analysisId: analysis.id,
        title: analysis.requirementRevision.title,
        projectId: analysis.snapshot.repository.projectId,
        repositoryId: analysis.snapshot.repositoryId,
        targetRef: analysis.sourceTarget.requestedRef,
        commitSha: analysis.snapshot.commitSha,
        snapshotId: analysis.snapshot.id,
        analyzerVersion: analysis.snapshot.analyzerVersion,
        generatedDocumentId: 'pending',
        generatedAt: new Date().toISOString(),
        finalizedAt: analysis.updatedAt.toISOString(),
        staleStatusAtReadTime: false,
      },
    });
  }

  private toErrorJson(error: unknown) {
    if (error instanceof Error) {
      return {
        message: error.message,
        name: error.name,
      };
    }
    return {
      message: String(error),
    };
  }
}
