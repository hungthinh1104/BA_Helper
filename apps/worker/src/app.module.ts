import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ImpactAnalysisWorkerModule } from './impact-analysis/impact-analysis.worker.module';
import { ScanJobWorkerModule } from './scan-job/scan-job.worker.module';
import { EmbeddingWorkerModule } from './embedding/embedding.worker.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      },
    }),
    BullModule.registerQueue({ name: 'impact-analysis' }),
    BullModule.registerQueue({ name: 'scan-job' }),
    BullModule.registerQueue({ name: 'embedding' }),
    ImpactAnalysisWorkerModule,
    ScanJobWorkerModule,
    EmbeddingWorkerModule,
  ],
})
export class AppModule {}
