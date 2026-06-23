import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { MarkdownImpactReportBuilder } from '../../document/application/markdown-impact-report.builder';
import { InsightRepository } from '../../insight/infrastructure/insight.repository';
import { TraceabilityRepository } from '../../traceability/infrastructure/traceability.repository';
import { ReviewNoteRepository } from '../infrastructure/review-note.repository';
import { GraphRepository } from '../../graph/infrastructure/graph.repository';
import { ClarificationRepository } from '../../clarification/infrastructure/clarification.repository';
import { ReviewDecisionRepository } from '../infrastructure/review-decision.repository';
import { GetImpactDiffUseCase } from '../application/queries/get-impact-diff.usecase';
import { DocumentRepository } from '../../document/infrastructure/document.repository';

@Processor('document-job')
export class DocumentJobWorker extends WorkerHost {
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
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { snapshotId, documentType } = job.data;
    if (documentType !== 'IMPACT_REPORT') {
      throw new Error(`Unsupported document type: ${documentType}`);
    }

    // 1. Find DocumentJob and mark RUNNING
    let docJob = await this.prisma.documentJob.findUnique({
      where: { snapshotId_documentType: { snapshotId, documentType } },
    });

    if (!docJob) {
      throw new Error(`DocumentJob not found for snapshot: ${snapshotId}`);
    }

    docJob = await this.prisma.documentJob.update({
      where: { id: docJob.id },
      data: { status: 'RUNNING', lastStartedAt: new Date() },
    });

    try {
      // 2. Load ReviewedReportSnapshot and Analysis
      const snapshot = await this.prisma.reviewedReportSnapshot.findUnique({
        where: { id: snapshotId },
      });
      if (!snapshot) {
        throw new Error('ReviewedReportSnapshot not found.');
      }

      const analysisId = snapshot.analysisId;
      const analysis = await this.prisma.impactAnalysis.findUnique({
        where: { id: analysisId },
        include: {
          snapshot: { include: { repository: true } },
          sourceTarget: true,
          requirementRevision: { include: { requirement: true } },
          insights: true,
        },
      });

      if (!analysis) {
        throw new Error('ImpactAnalysis not found.');
      }

      // 3. Load graph data
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

      // 4. Upsert GeneratedDocument synchronously (placeholder first, then replace with content)
      // Actually we can just build the markdown and then upsert
      const markdown = this.reportBuilder.build({
        analysis: analysis as any,
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
          generatedDocumentId: 'temp', // Not used strictly inside builder unless needed for header link?
          generatedAt: new Date().toISOString(),
          finalizedAt: analysis.updatedAt.toISOString(),
          staleStatusAtReadTime: false,
        },
      });

      const persistedReport = await this.documentRepo.upsertApproved({
        impactAnalysisId: analysisId,
        content: markdown,
      });

      // 5. Update DocumentJob to COMPLETED
      await this.prisma.documentJob.update({
        where: { id: docJob.id },
        data: {
          status: 'COMPLETED',
          progress: 100,
          completedAt: new Date(),
          generatedDocumentId: persistedReport.id,
        },
      });
      
      // Update the snapshot to link the approved document id
      await this.prisma.reviewedReportSnapshot.update({
        where: { id: snapshot.id },
        data: { approvedDocumentId: persistedReport.id },
      });

      return { success: true };
    } catch (e: any) {
      // Mark as FAILED
      await this.prisma.documentJob.update({
        where: { id: docJob.id },
        data: {
          status: 'FAILED',
          error: e.message || String(e),
          failedAt: new Date(),
        },
      });
      throw e;
    }
  }
}
