import { Module } from '@nestjs/common';
import { LocalizationController } from './localization.controller';
import { LocalizationModule, PrismaModule } from '@ba-helper/backend-runtime';
import { ProjectModule } from '../project/project.module';
import { DocumentModule } from '../document/document.module';
import { GenerateLocalizedReportUseCase } from './application/generate-localized-report.usecase';
import { GetLocalizationStatusUseCase } from './application/get-localization-status.usecase';
import { LocalizationStatusRepository } from './infrastructure/localization-status.repository';

@Module({
  imports: [LocalizationModule, PrismaModule, ProjectModule, DocumentModule],
  controllers: [LocalizationController],
  providers: [
    GenerateLocalizedReportUseCase,
    GetLocalizationStatusUseCase,
    LocalizationStatusRepository,
  ],
})
export class ApiLocalizationModule {}
