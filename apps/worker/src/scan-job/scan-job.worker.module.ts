import { Module } from '@nestjs/common';
import { ScanJobProcessor } from './scan-job.processor';
import { RunScanJobUseCase } from '@ba-helper/api/modules/scanner/application/run-scan-job.usecase';
import { RunScanJobPersistenceStep } from '@ba-helper/api/modules/scanner/application/run-scan-job-persistence.step';
import { ScanJobRepository } from '@ba-helper/api/modules/scanner/infrastructure/scan-job.repository';
import { RepositoryRepository } from '@ba-helper/api/modules/repository/infrastructure/repository.repository';
import { ArtifactRepository } from '@ba-helper/api/modules/artifact/infrastructure/artifact.repository';
import { EvidenceRepository } from '@ba-helper/api/modules/evidence/infrastructure/evidence.repository';
import { GraphRepository } from '@ba-helper/api/modules/graph/infrastructure/graph.repository';
import { EventLogRepository } from '@ba-helper/api/modules/event-log/infrastructure/event-log.repository';
import { EventLogService } from '@ba-helper/api/modules/event-log/application/event-log.service';
import { QueueModule } from '@ba-helper/api/modules/queue/queue.module';
import { QueueService } from '@ba-helper/api/modules/queue/queue.service';
// v0.1: use API PrismaModule/PrismaService so repository constructors receive the correct type.
// Worker-local PrismaModule is only for modules with worker-only infrastructure (embedding).
import { PrismaModule } from '@ba-helper/api/modules/prisma/prisma.module';
import { PrismaService } from '@ba-helper/api/modules/prisma/prisma.service';

/**
 * Worker-scoped ScanJob module.
 * Wires RunScanJobUseCase without loading ScannerModule (which includes the HTTP controller).
 * Infrastructure classes are imported from apps/api paths (v0.1 constraint).
 *
 * NOTE: Post-v0.1, infrastructure classes should be extracted to
 * a shared backend-infrastructure package.
 */
@Module({
  imports: [PrismaModule, QueueModule],
  providers: [
    ScanJobProcessor,
    {
      provide: ScanJobRepository,
      useFactory: (prisma: PrismaService) => new ScanJobRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: RepositoryRepository,
      useFactory: (prisma: PrismaService) => new RepositoryRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ArtifactRepository,
      useFactory: (prisma: PrismaService) => new ArtifactRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: EvidenceRepository,
      useFactory: (prisma: PrismaService) => new EvidenceRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: GraphRepository,
      useFactory: (prisma: PrismaService) => new GraphRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: EventLogRepository,
      useFactory: (prisma: PrismaService) => new EventLogRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: EventLogService,
      useFactory: (repo: EventLogRepository) => new EventLogService(repo),
      inject: [EventLogRepository],
    },
    {
      provide: RunScanJobPersistenceStep,
      useFactory: (
        prisma: PrismaService,
        artifactRepo: ArtifactRepository,
        graphRepo: GraphRepository,
        evidenceRepo: EvidenceRepository,
        scanJobRepo: ScanJobRepository,
      ) => new RunScanJobPersistenceStep(prisma, artifactRepo, graphRepo, evidenceRepo, scanJobRepo),
      inject: [PrismaService, ArtifactRepository, GraphRepository, EvidenceRepository, ScanJobRepository],
    },
    {
      provide: RunScanJobUseCase,
      useFactory: (
        scanJobRepo: ScanJobRepository,
        eventLogService: EventLogService,
        queueService: QueueService,
        persistenceStep: RunScanJobPersistenceStep,
      ) => new RunScanJobUseCase(scanJobRepo, eventLogService, queueService, persistenceStep),
      inject: [ScanJobRepository, EventLogService, QueueService, RunScanJobPersistenceStep],
    },
  ],
})
export class ScanJobWorkerModule {}
