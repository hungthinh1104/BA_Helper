import { Controller, Post, Get, Param, Body, UseGuards, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ReportLocalizationService, PrismaService } from '@ba-helper/backend-runtime';
import { GenerateLocalizedReportRequest, generateLocalizedReportRequestSchema, LocalizedReportArtifact, SupportedReportLocale, LocalizationStatusResponse } from '@ba-helper/contracts';
import { ProjectPermissionService } from '../project/application/project-permission.service';
import { RolesGuard } from '../auth/application/roles.guard';
import { JwtAuthGuard } from '../auth/application/jwt-auth.guard';
import { CurrentUser } from '../auth/api/current-user.decorator';
import { RequestUser } from '@ba-helper/contracts';
import { ApprovedReportContextReader } from '../document/application/queries/approved-report-context.reader';

@Controller('api/v1/analyses/:analysisId/localization')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocalizationController {
  constructor(
    private readonly localizationService: ReportLocalizationService,
    private readonly prisma: PrismaService,
    private readonly permissions: ProjectPermissionService,
    private readonly contextReader: ApprovedReportContextReader,
  ) {}

  @Post()
  async generateLocalizedReport(
    @Param('analysisId') analysisId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser
  ): Promise<LocalizedReportArtifact> {
    const input = generateLocalizedReportRequestSchema.parse(body);

    // TODO: add stricter report-localization permission, using read analysis for now
    await this.permissions.assertCanReadAnalysis(actor, analysisId);

    const { sourceDocument, canonicalContext } = await this.contextReader.readContext(analysisId);

    const localizedArtifact = await this.localizationService.localizeReport(
      sourceDocument.id,
      canonicalContext,
      input.locale
    );

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
    @Param('locale') locale: SupportedReportLocale,
    @CurrentUser() actor: RequestUser
  ): Promise<LocalizationStatusResponse> {
    await this.permissions.assertCanReadAnalysis(actor, analysisId);

    const analysis = await this.prisma.impactAnalysis.findUnique({
      where: { id: analysisId },
      include: {
        snapshot: { include: { repository: true, profile: true } },
        sourceTarget: true,
        requirementRevision: true,
      }
    });

    if (!analysis) {
      throw new NotFoundException('Analysis not found');
    }

    const document = await this.prisma.generatedDocument.findFirst({
      where: {
        impactAnalysisId: analysisId,
        type: 'IMPACT_REPORT',
        status: 'APPROVED',
      }
    });

    if (!document) {
      return { 
        status: 'SOURCE_NOT_READY',
        locale,
        sourceDocumentId: null,
        errorCode: null,
        updatedAt: null,
      };
    }

    const localized = await this.prisma.localizedReportArtifact.findUnique({
      where: {
        sourceDocumentId_locale: {
          sourceDocumentId: document.id,
          locale,
        }
      }
    });

    if (!localized) {
      return { 
        status: 'NOT_TRANSLATED',
        locale,
        sourceDocumentId: document.id,
        errorCode: null,
        updatedAt: null,
      };
    }

    const baseResponse = {
      locale,
      sourceDocumentId: document.id,
      errorCode: localized.errorCode,
      updatedAt: localized.updatedAt.toISOString(),
    };

    if (localized.localizationStatus === 'QUEUED') {
      return { ...baseResponse, status: 'QUEUED' };
    }

    if (localized.localizationStatus === 'FAILED') {
      return { ...baseResponse, status: 'FAILED' };
    }

    try {
      const { sourceContentHash } = await this.contextReader.readContext(analysisId);
      
      if (localized.sourceContentHash !== sourceContentHash) {
        return { ...baseResponse, status: 'OUT_OF_SYNC' };
      }

      return { ...baseResponse, status: 'READY' };
    } catch (e) {
      return { ...baseResponse, status: 'SOURCE_NOT_READY' };
    }
  }
}
