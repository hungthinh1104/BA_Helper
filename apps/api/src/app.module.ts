import { Module } from '@nestjs/common';
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
import { SystemModule } from './modules/system/system.module';
import { ClarificationModule } from './modules/clarification/clarification.module';
import { ApiLocalizationModule } from './modules/localization/localization.module';
import { ApiDomainPackModule } from './modules/domain-pack/domain-pack.module';

import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/application/jwt-auth.guard';
import { RolesGuard } from './modules/auth/application/roles.guard';
import { PublicBetaRateLimitGuard } from './shared/rate-limit/public-beta-rate-limit.guard';
import { PublicBetaRateLimitPolicy } from './shared/rate-limit/public-beta-rate-limit.policy';
import { PrismaModule, QueueModule, AiModule } from "@ba-helper/backend-runtime";

@Module({
  imports: [
    AuthModule,
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
    SystemModule,
    ClarificationModule,
    ApiLocalizationModule,
    ApiDomainPackModule,
    AiModule.forRoot(),
  ],
  providers: [
    {
      provide: 'APP_GUARD',
      useClass: JwtAuthGuard,
    },
    {
      provide: 'APP_GUARD',
      useClass: RolesGuard,
    },
    PublicBetaRateLimitPolicy,
    {
      provide: 'APP_GUARD',
      useClass: PublicBetaRateLimitGuard,
    },
  ],
})
export class AppModule {}
