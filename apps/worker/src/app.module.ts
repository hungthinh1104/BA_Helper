import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ImpactAnalysisWorkerModule } from './impact-analysis/impact-analysis.worker.module';
import { ScanJobWorkerModule } from './scan-job/scan-job.worker.module';
import { EmbeddingWorkerModule } from './embedding/embedding.worker.module';
import { DocumentJobWorkerModule } from './document-job/document-job.worker.module';
import { StaleJobRecoveryService } from './shared/stale-job-recovery.service';
import { AiModule } from '@ba-helper/backend-runtime';
import { PrismaModule } from '@ba-helper/backend-runtime/prisma';
import { QueueService } from '@ba-helper/backend-runtime/queue';
import { requireEnv } from '@ba-helper/shared';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        url: requireEnv('REDIS_URL', 'redis://localhost:6379'),
      },
    }),
    BullModule.registerQueue({ name: 'impact-analysis' }),
    BullModule.registerQueue({ name: 'scan-job' }),
    BullModule.registerQueue({ name: 'embedding' }),
    BullModule.registerQueue({ name: 'document-job' }),
    AiModule.forRoot(),
    PrismaModule,
    ImpactAnalysisWorkerModule,
    ScanJobWorkerModule,
    EmbeddingWorkerModule,
    DocumentJobWorkerModule,
  ],
  providers: [QueueService, StaleJobRecoveryService],
})
export class AppModule {}
