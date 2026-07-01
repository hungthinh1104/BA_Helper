import { Module } from '@nestjs/common';
import { LocalizationController } from './localization.controller';
import { LocalizationModule, PrismaModule } from '@ba-helper/backend-runtime';
import { ProjectModule } from '../project/project.module';
import { DocumentModule } from '../document/document.module';

@Module({
  imports: [LocalizationModule, PrismaModule, ProjectModule, DocumentModule],
  controllers: [LocalizationController],
})
export class ApiLocalizationModule {}
