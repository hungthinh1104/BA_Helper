import { Module } from '@nestjs/common';
import { RunDocumentJobUseCase } from './application/run-document-job.usecase';
import { MarkdownImpactReportBuilder } from './application/render/markdown-impact-report.builder';
import { ReviewedSnapshotReportContextAdapter } from './application/render/reviewed-snapshot-report-context.adapter';
import { MermaidImpactDiagramBuilder } from './application/mermaid-impact-diagram.builder';
import { EvaluationContextAdapter } from './application/evaluation-context.adapter';
import { GetImpactDiffUseCase } from '../impact-analysis/application/queries/get-impact-diff.usecase';
import { EventLogModule } from '../event-log/event-log.module';
import { PrismaModule } from '../prisma/prisma.module';
// Wait, repositories should also be provided, but they might be provided globally or we can just provide them here.
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
    DocumentRepository,
    TraceabilityRepository,
    GraphRepository,
    InsightRepository,
    ReviewNoteRepository,
    ReviewClarificationRepository,
    ReviewDecisionRepository,
    ImpactAnalysisRepository,
  ],
  exports: [
    RunDocumentJobUseCase,
  ],
})
export class DocumentRuntimeModule {}
