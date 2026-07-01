import { Module } from '@nestjs/common';
import { ScanJobController } from './api/scan-job.controller';
import { CreateScanJobUseCase } from './application/create-scan-job.usecase';
import { EventLogModule } from '../event-log/event-log.module';
import { RepositoryModule } from '../repository/repository.module';
import { ArtifactModule } from '../artifact/artifact.module';
import { EvidenceModule } from '../evidence/evidence.module';
import { ProjectModule } from '../project/project.module';
import { GraphModule } from '../graph/graph.module';
import { PrismaModule, PrismaService, RepositoryRepository, ArtifactRepository, RunScanJobPersistenceStep, RunScanJobUseCase, ScanJobRepository, QueueModule, QueueService, EventLogService } from "@ba-helper/backend-runtime";

@Module({
  imports: [PrismaModule, EventLogModule, RepositoryModule, ArtifactModule, QueueModule, EvidenceModule, ProjectModule, GraphModule],
  controllers: [ScanJobController],
  providers: [
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
    RunScanJobPersistenceStep,
    RunScanJobUseCase,
    CreateScanJobUseCase,
  ],
  exports: [RunScanJobUseCase, ScanJobRepository],
})
export class ScannerModule {}
