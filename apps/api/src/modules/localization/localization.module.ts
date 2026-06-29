import { Module } from '@nestjs/common';
import { LocalizationController } from './localization.controller';
import { LocalizationModule } from '@ba-helper/backend-runtime';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [LocalizationModule, PrismaModule, ProjectModule],
  controllers: [LocalizationController],
})
export class ApiLocalizationModule {}
