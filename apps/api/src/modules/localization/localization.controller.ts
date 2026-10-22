import { parseApiInput } from '../../shared/parse-api-input';
import {
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { generateLocalizedReportRequestSchema, supportedReportLocaleSchema } from '@ba-helper/contracts';
import type {
  LocalizedReportArtifact,
  LocalizationStatusResponse,
  RequestUser,
} from '@ba-helper/contracts';
import { RolesGuard } from '../auth/application/roles.guard';
import { JwtAuthGuard } from '../auth/application/jwt-auth.guard';
import { CurrentUser } from '../auth/api/current-user.decorator';
import { Roles } from '../auth/api/roles.decorator';
import { GenerateLocalizedReportUseCase } from './application/generate-localized-report.usecase';
import { GetLocalizationStatusUseCase } from './application/get-localization-status.usecase';

@Controller('api/v1/analyses/:analysisId/localization')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocalizationController {
  constructor(
    private readonly generateLocalizedReportUseCase: GenerateLocalizedReportUseCase,
    private readonly getLocalizationStatusUseCase: GetLocalizationStatusUseCase,
  ) {}

  @Post()
  @Roles('ADMIN', 'REVIEWER')
  async generateLocalizedReport(
    @Param('analysisId') analysisId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser
  ): Promise<LocalizedReportArtifact> {
    const input = parseApiInput(generateLocalizedReportRequestSchema, body);

    const localizedArtifact = await this.generateLocalizedReportUseCase.execute({
      analysisId,
      actor,
      locale: input.locale,
    });

    if (localizedArtifact.localizationStatus === 'FAILED') {
      throw new InternalServerErrorException({
        message: 'Localization failed',
        errorCode: localizedArtifact.errorCode,
      });
    }

    return localizedArtifact;
  }

  @Get(':locale/status')
  async getLocalizationStatus(
    @Param('analysisId') analysisId: string,
    @Param('locale') localeInput: string,
    @CurrentUser() actor: RequestUser
  ): Promise<LocalizationStatusResponse> {
    const locale = parseApiInput(supportedReportLocaleSchema, localeInput);
    return this.getLocalizationStatusUseCase.execute({ analysisId, locale, actor });
  }
}
