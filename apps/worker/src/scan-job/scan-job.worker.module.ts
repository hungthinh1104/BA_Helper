import { Module } from '@nestjs/common';
import { ScanJobProcessor } from './scan-job.processor';
import { RunScanJobUseCase } from '@ba-helper/backend-runtime';
import { RunScanJobPersistenceStep } from '@ba-helper/backend-runtime';
import { ScanJobRepository } from '@ba-helper/backend-runtime';
import { RepositoryRepository } from '@ba-helper/backend-runtime';
import { ArtifactRepository } from '@ba-helper/backend-runtime';
import { EvidenceRepository } from '@ba-helper/backend-runtime';
import { GraphRepository } from '@ba-helper/backend-runtime';
import { EventLogRepository } from '@ba-helper/backend-runtime';
import { EventLogService } from '@ba-helper/backend-runtime';
import { QueueModule } from '@ba-helper/backend-runtime';
import { QueueService } from '@ba-helper/backend-runtime';
// v0.1: use API PrismaModule/PrismaService so repository constructors receive the correct type.
// Worker-local PrismaModule is only for modules with worker-only infrastructure (embedding).
import { PrismaModule } from '@ba-helper/backend-runtime';
import { PrismaService } from '@ba-helper/backend-runtime';

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
