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
import { EvidenceModule } from '../../../api/src/modules/evidence/evidence.module';
import { EvidenceRepository } from '../../../api/src/modules/evidence/infrastructure/evidence.repository';

@Module({
  imports: [PrismaModule, ScannerModule, EventLogModule, ArtifactModule, QueueModule, EvidenceModule],
  providers: [
    ScanJobRepository,
    RunScanJobUseCase,
    ScanJobProcessor,
  ],
})
export class ScanJobWorkerModule {}
