import { Module } from '@nestjs/common';
import { EventLogModule } from '../event-log/event-log.module';
import { TraceabilityModule } from '../traceability/traceability.module';
import { InsightModule } from '../insight/insight.module';
import { GraphModule } from '../graph/graph.module';
import { ClarificationModule } from '../clarification/clarification.module';
import { CreateReviewedReportSnapshotUseCase } from './application/commands/create-reviewed-report-snapshot.usecase';
import { EnqueueDocumentJobUseCase } from './application/commands/enqueue-document-job.usecase';
import { GetFinalReviewedReportUseCase } from './application/queries/get-final-reviewed-report.usecase';
import { GetLatestReviewedReportSnapshotUseCase } from './application/queries/get-latest-reviewed-report-snapshot.usecase';
import { ListDocumentsUseCase } from './application/queries/list-documents.usecase';
import { ApprovedReportContextReader } from './application/queries/approved-report-context.reader';

import { PrismaModule, QueueModule, DocumentRuntimeModule, DocumentRepository } from "@ba-helper/backend-runtime";

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    EventLogModule,
    TraceabilityModule,
    InsightModule,
    GraphModule,
    ClarificationModule,
    DocumentRuntimeModule,
  ],
  providers: [
    CreateReviewedReportSnapshotUseCase,
    EnqueueDocumentJobUseCase,
    GetFinalReviewedReportUseCase,
    GetLatestReviewedReportSnapshotUseCase,
    ApprovedReportContextReader,
    {
      provide: ListDocumentsUseCase,
      useFactory: (repo: DocumentRepository) => new ListDocumentsUseCase(repo),
      inject: [DocumentRepository],
    },
  ],
  exports: [
    CreateReviewedReportSnapshotUseCase,
    EnqueueDocumentJobUseCase,
    GetFinalReviewedReportUseCase,
    GetLatestReviewedReportSnapshotUseCase,
    ListDocumentsUseCase,
    ApprovedReportContextReader,
    DocumentRuntimeModule,
  ],
})
export class DocumentApplicationModule {}
