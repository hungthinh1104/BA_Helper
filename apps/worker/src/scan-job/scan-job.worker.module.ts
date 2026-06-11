import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../api/src/modules/prisma/prisma.module';
import { PrismaService } from '../../../api/src/modules/prisma/prisma.service';
import { ScannerModule } from '../../../api/src/modules/scanner/scanner.module';
import { EventLogModule } from '../../../api/src/modules/event-log/event-log.module';
import { EventLogService } from '../../../api/src/modules/event-log/application/event-log.service';
import { ScanJobProcessor } from './scan-job.processor';
import { ScanJobRepository } from '../../../api/src/modules/scanner/infrastructure/scan-job.repository';
import { RunScanJobUseCase } from '../../../api/src/modules/scanner/application/run-scan-job.usecase';
import { ArtifactRepository } from '../../../api/src/modules/artifact/infrastructure/artifact.repository';
import { ArtifactModule } from '../../../api/src/modules/artifact/artifact.module';
import { QueueModule } from '../../../api/src/modules/queue/queue.module';
import { QueueService } from '../../../api/src/modules/queue/queue.service';

@Module({
  imports: [PrismaModule, ScannerModule, EventLogModule, ArtifactModule, QueueModule],
  providers: [
    {
      provide: ScanJobRepository,
      useFactory: (prisma: PrismaService) => new ScanJobRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: RunScanJobUseCase,
      useFactory: (
        scanRepo: ScanJobRepository,
        artifactRepo: ArtifactRepository,
        eventLog: EventLogService,
        prisma: PrismaService,
        queueService: QueueService,
      ) => new RunScanJobUseCase(scanRepo, artifactRepo, eventLog, prisma, queueService),
      inject: [ScanJobRepository, ArtifactRepository, EventLogService, PrismaService, QueueService],
    },
    {
      provide: ScanJobProcessor,
      useFactory: (runScanJob: RunScanJobUseCase) =>
        new ScanJobProcessor(runScanJob),
      inject: [RunScanJobUseCase],
    },
  ],
})
export class ScanJobWorkerModule {}
