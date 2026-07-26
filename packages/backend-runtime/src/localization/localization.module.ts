import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DomainPackModule } from '../domain-pack/domain-pack.module';
import { DocumentRuntimeModule } from '../document/document-runtime.module';
import { ReportLocalizationService } from './application/report-localization.service';
import { TranslationProviderPort } from './application/translation-provider.port';
import { FakeTranslationProvider } from './infrastructure/fake-translation.provider';
import { StructuralValidator } from './domain/structural-validator';
import { LocalizedArtifactRepository } from './infrastructure/localized-artifact.repository';

@Module({
  imports: [PrismaModule, DomainPackModule, DocumentRuntimeModule],
  providers: [
    {
      provide: TranslationProviderPort,
      useClass: FakeTranslationProvider,
    },
    StructuralValidator,
    LocalizedArtifactRepository,
    ReportLocalizationService,
  ],
  exports: [ReportLocalizationService, LocalizedArtifactRepository],
})
export class LocalizationModule {}
