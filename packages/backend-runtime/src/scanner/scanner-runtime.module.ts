import { Module } from '@nestjs/common';
import {
  RunScanJobUseCase,
  ScanJobRunnerPort,
} from '@ba-helper/application/scanner';
import { ArtifactRepository } from '../artifact/infrastructure/artifact.repository';
import { EventLogService } from '../event-log/application/event-log.service';
import { EventLogRepository } from '../event-log/infrastructure/event-log.repository';
import { EvidenceRepository } from '../evidence/infrastructure/evidence.repository';
import { GraphRepository } from '../graph/infrastructure/graph.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { QueueModule } from '../queue/queue.module';
import { QueueService } from '../queue/queue.service';
import { RepositoryRepository } from '../repository/infrastructure/repository.repository';
import { RunScanJobPersistenceStep } from './application/run-scan-job-persistence.step';
import { RuntimeScanJobRunnerAdapter } from './infrastructure/runtime-scan-job-runner.adapter';
import { ScanJobRepository } from './infrastructure/scan-job.repository';

@Module({
  imports: [PrismaModule, QueueModule],
  providers: [
    ...[
      ArtifactRepository,
      EvidenceRepository,
      GraphRepository,
      RepositoryRepository,
      ScanJobRepository,
    ].map((repository) => ({
      provide: repository,
      useFactory: (prisma: PrismaService) => new repository(prisma),
      inject: [PrismaService],
    })),
    {
      provide: EventLogRepository,
      useFactory: (prisma: PrismaService) => new EventLogRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: EventLogService,
      useFactory: (repository: EventLogRepository) =>
        new EventLogService(repository),
      inject: [EventLogRepository],
    },
    RunScanJobPersistenceStep,
    RuntimeScanJobRunnerAdapter,
    {
      provide: ScanJobRunnerPort,
      useExisting: RuntimeScanJobRunnerAdapter,
    },
    {
      provide: RunScanJobUseCase,
      useFactory: (runner: ScanJobRunnerPort) =>
        new RunScanJobUseCase(runner),
      inject: [ScanJobRunnerPort],
    },
  ],
  exports: [
    RunScanJobUseCase,
    ScanJobRepository,
    RepositoryRepository,
    QueueModule,
  ],
})
export class ScannerRuntimeModule {}
