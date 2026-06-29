import { Module } from '@nestjs/common';
import { LocalizationController } from './localization.controller';
import { LocalizationModule } from '@ba-helper/backend-runtime';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [LocalizationModule, PrismaModule],
  controllers: [LocalizationController],
})
export class ApiLocalizationModule {}
