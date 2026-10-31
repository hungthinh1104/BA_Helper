import { Module } from '@nestjs/common';
import { ImpactAnalysisWorkerModule } from './impact-analysis/impact-analysis.worker.module';
import { ScanJobWorkerModule } from './scan-job/scan-job.worker.module';
import { EmbeddingWorkerModule } from './embedding/embedding.worker.module';
import { DocumentJobWorkerModule } from './document-job/document-job.worker.module';
import { StaleJobRecoveryService } from './shared/stale-job-recovery.service';
import { AiModule, EventLogModule } from '@ba-helper/backend-runtime';
import { PrismaModule } from '@ba-helper/backend-runtime/prisma';
import { QueueModule } from '@ba-helper/backend-runtime/queue';

@Module({
  imports: [
    QueueModule,
    AiModule.forRoot(),
    PrismaModule,
    EventLogModule,
    ImpactAnalysisWorkerModule,
    ScanJobWorkerModule,
    EmbeddingWorkerModule,
    DocumentJobWorkerModule,
  ],
  providers: [StaleJobRecoveryService],
})
export class AppModule {}
