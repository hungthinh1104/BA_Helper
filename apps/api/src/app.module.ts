import { Module } from '@nestjs/common';
import { PrismaModule } from './modules/prisma/prisma.module';
import { EventLogModule } from './modules/event-log/event-log.module';
import { ProjectModule } from './modules/project/project.module';
import { RepositoryModule } from './modules/repository/repository.module';
import { ScannerModule } from './modules/scanner/scanner.module';
import { RequirementModule } from './modules/requirement/requirement.module';
import { ImpactAnalysisModule } from './modules/impact-analysis/impact-analysis.module';
import { InsightModule } from './modules/insight/insight.module';
import { TraceabilityModule } from './modules/traceability/traceability.module';
import { DocumentModule } from './modules/document/document.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { ArtifactModule } from './modules/artifact/artifact.module';
import { GraphModule } from './modules/graph/graph.module';
import { QueueModule } from './modules/queue/queue.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    PrismaModule,
    EventLogModule,
    ProjectModule,
    RepositoryModule,
    ScannerModule,
    RequirementModule,
    ImpactAnalysisModule,
    InsightModule,
    TraceabilityModule,
    DocumentModule,
    EvidenceModule,
    ArtifactModule,
    GraphModule,
    QueueModule,
    AiModule.forRoot(),
  ],
})
export class AppModule {}
