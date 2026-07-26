import { Module } from '@nestjs/common';
import { ScanJobController } from './api/scan-job.controller';
import { CreateScanJobUseCase } from './application/create-scan-job.usecase';
import { EventLogModule } from '../event-log/event-log.module';
import { RepositoryModule } from '../repository/repository.module';
import { ArtifactModule } from '../artifact/artifact.module';
import { EvidenceModule } from '../evidence/evidence.module';
import { ProjectModule } from '../project/project.module';
import { GraphModule } from '../graph/graph.module';
import { ScannerRuntimeModule } from "@ba-helper/backend-runtime/scanner";

@Module({
  imports: [ScannerRuntimeModule, EventLogModule, RepositoryModule, ArtifactModule, EvidenceModule, ProjectModule, GraphModule],
  controllers: [ScanJobController],
  providers: [
    CreateScanJobUseCase,
  ],
  exports: [ScannerRuntimeModule],
})
export class ScannerModule {}
