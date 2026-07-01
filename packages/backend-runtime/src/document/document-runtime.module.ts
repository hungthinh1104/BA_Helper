import { Module } from '@nestjs/common';
import { RunDocumentJobUseCase } from './application/run-document-job.usecase';
import { MarkdownImpactReportBuilder } from './application/render/markdown-impact-report.builder';
import { ReviewedSnapshotReportContextAdapter } from './application/render/reviewed-snapshot-report-context.adapter';
import { MermaidImpactDiagramBuilder } from './application/mermaid-impact-diagram.builder';
import { EvaluationContextAdapter } from './application/evaluation-context.adapter';
import { GetImpactDiffUseCase } from '../impact-analysis/application/queries/get-impact-diff.usecase';
import { EventLogModule } from '../event-log/event-log.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentRepository } from './infrastructure/document.repository';
import { TraceabilityRepository } from '../traceability/infrastructure/traceability.repository';
import { GraphRepository } from '../graph/infrastructure/graph.repository';
import { InsightRepository } from '../insight/infrastructure/insight.repository';
import { ReviewNoteRepository } from '../impact-analysis/infrastructure/review-note.repository';
import { ReviewClarificationRepository } from '../impact-analysis/infrastructure/review-clarification.repository';
import { ReviewDecisionRepository } from '../impact-analysis/infrastructure/review-decision.repository';
import { ImpactAnalysisRepository } from '../impact-analysis/infrastructure/impact-analysis.repository';

@Module({
  imports: [PrismaModule, EventLogModule],
  providers: [
    RunDocumentJobUseCase,
    MarkdownImpactReportBuilder,
    ReviewedSnapshotReportContextAdapter,
    MermaidImpactDiagramBuilder,
    EvaluationContextAdapter,
    GetImpactDiffUseCase,
    {
      provide: DocumentRepository,
      useFactory: (prisma: PrismaService) => new DocumentRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: TraceabilityRepository,
      useFactory: (prisma: PrismaService) => new TraceabilityRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: GraphRepository,
      useFactory: (prisma: PrismaService) => new GraphRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: InsightRepository,
      useFactory: (prisma: PrismaService) => new InsightRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ReviewNoteRepository,
      useFactory: (prisma: PrismaService) => new ReviewNoteRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ReviewClarificationRepository,
      useFactory: (prisma: PrismaService) => new ReviewClarificationRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ReviewDecisionRepository,
      useFactory: (prisma: PrismaService) => new ReviewDecisionRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ImpactAnalysisRepository,
      useFactory: (prisma: PrismaService) => new ImpactAnalysisRepository(prisma),
      inject: [PrismaService],
    },
  ],
  exports: [
    RunDocumentJobUseCase,
    MarkdownImpactReportBuilder,
    ReviewedSnapshotReportContextAdapter,
    MermaidImpactDiagramBuilder,
    EvaluationContextAdapter,
    GetImpactDiffUseCase,
    DocumentRepository,
    TraceabilityRepository,
    GraphRepository,
    InsightRepository,
    ReviewNoteRepository,
    ReviewClarificationRepository,
    ReviewDecisionRepository,
    ImpactAnalysisRepository,
  ],
})
export class DocumentRuntimeModule {}
