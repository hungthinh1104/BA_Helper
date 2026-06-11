import { Module } from '@nestjs/common';
import { ScanJobController } from './api/scan-job.controller';
import { CreateScanJobUseCase } from './application/create-scan-job.usecase';
import { RunScanJobUseCase } from './application/run-scan-job.usecase';
import { ScanJobRepository } from './infrastructure/scan-job.repository';
import { RepositoryRepository } from '../repository/infrastructure/repository.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { EventLogModule } from '../event-log/event-log.module';
import { EventLogService } from '../event-log/application/event-log.service';
import { RepositoryModule } from '../repository/repository.module';
import { ArtifactModule } from '../artifact/artifact.module';
import { ArtifactRepository } from '../artifact/infrastructure/artifact.repository';
import { QueueModule } from '../queue/queue.module';
import { QueueService } from '../queue/queue.service';

@Module({
  imports: [PrismaModule, EventLogModule, RepositoryModule, ArtifactModule, QueueModule],
  controllers: [ScanJobController],
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
      provide: RepositoryRepository,
      useFactory: (prisma: PrismaService) => new RepositoryRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: CreateScanJobUseCase,
      useFactory: (
        scanRepo: ScanJobRepository,
        repoRepo: RepositoryRepository,
        eventLog: EventLogService,
      ) => new CreateScanJobUseCase(scanRepo, repoRepo, eventLog),
      inject: [ScanJobRepository, RepositoryRepository, EventLogService],
    },
  ],
  exports: [RunScanJobUseCase, ScanJobRepository],
})
export class ScannerModule {}
