import { Controller, Post, Get, Param, Body, UseGuards, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ReportLocalizationService, MarkdownReportRenderContext, computeCanonicalReportHash } from '@ba-helper/backend-runtime';
import { GenerateLocalizedReportRequest, generateLocalizedReportRequestSchema, LocalizedReportArtifact, SupportedReportLocale, LocalizationStatusResponse } from '@ba-helper/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectPermissionService } from '../project/application/project-permission.service';
import { RolesGuard } from '../auth/application/roles.guard';
import { JwtAuthGuard } from '../auth/application/jwt-auth.guard';
import { CurrentUser } from '../auth/api/current-user.decorator';
import { RequestUser } from '@ba-helper/contracts';

@Controller('api/v1/analyses/:analysisId/localization')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocalizationController {
  constructor(
    private readonly localizationService: ReportLocalizationService,
    private readonly prisma: PrismaService,
    private readonly permissions: ProjectPermissionService,
  ) {}

  @Post()
  async generateLocalizedReport(
    @Param('analysisId') analysisId: string,
    @Body() body: unknown
  ): Promise<LocalizedReportArtifact> {
    const input = generateLocalizedReportRequestSchema.parse(body);
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
      throw new NotFoundException('Approved impact report not found for localization');
    }
    
    // We also need the snapshot data to reconstruct canonical context
    const reviewedSnapshot = await this.prisma.reviewedReportSnapshot.findFirst({
      where: { approvedDocumentId: document.id }
    });

    if (!reviewedSnapshot) {
      throw new NotFoundException('Reviewed snapshot missing for approved document');
    }

    // Fetch the rest of the dependencies to rebuild the MarkdownRenderContext
    const insights = await this.prisma.baInsight.findMany({
      where: { impactAnalysisId: analysisId },
      include: { evidenceLinks: { include: { evidence: true } } }
    });

    const traceabilityLinks = await this.prisma.traceabilityLink.findMany({
      where: { impactAnalysisId: analysisId },
      include: { artifact: true, evidenceLinks: { include: { evidence: true } } }
    });

    const reviewNotes = await this.prisma.reviewNote.findMany({
      where: { impactAnalysisId: analysisId }
    });

    const clarifications = await this.prisma.clarificationItem.findMany({
      where: { impactAnalysisId: analysisId }
    });

    // We don't reconstruct everything because translatable extraction only cares about Insights, Clarifications, ReviewNotes.
    const canonicalContext: MarkdownReportRenderContext = {
      analysis: analysis as any,
      locale: 'en',
      insights: insights as any,
      traceabilityLinks: traceabilityLinks as any,
      reviewNotes,
      hasUnreviewedItems: false,
      dependencyEdges: [],
      clarifications: clarifications as any,
      reviewDecisions: [],
      reviewDecisionsSnapshot: reviewedSnapshot.reviewDecisionsSnapshot as any,
      evidenceQualitySummarySnapshot: reviewedSnapshot.evidenceQualitySummarySnapshot as any,
    };

    const localizedArtifact = await this.localizationService.localizeReport(
      document.id,
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
      return { status: 'SOURCE_NOT_READY' };
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
      return { status: 'NOT_TRANSLATED' };
    }

    if (localized.localizationStatus === 'QUEUED') {
      return { status: 'QUEUED' };
    }

    if (localized.localizationStatus === 'FAILED') {
      return { status: 'FAILED' };
    }

    // Check if out of sync
    const reviewedSnapshot = await this.prisma.reviewedReportSnapshot.findFirst({
      where: { approvedDocumentId: document.id }
    });

    if (!reviewedSnapshot) {
      return { status: 'SOURCE_NOT_READY' };
    }

    const insights = await this.prisma.baInsight.findMany({
      where: { impactAnalysisId: analysisId },
      include: { evidenceLinks: { include: { evidence: true } } }
    });

    const traceabilityLinks = await this.prisma.traceabilityLink.findMany({
      where: { impactAnalysisId: analysisId },
      include: { artifact: true, evidenceLinks: { include: { evidence: true } } }
    });

    const reviewNotes = await this.prisma.reviewNote.findMany({
      where: { impactAnalysisId: analysisId }
    });

    const clarifications = await this.prisma.clarificationItem.findMany({
      where: { impactAnalysisId: analysisId }
    });

    const canonicalContext: MarkdownReportRenderContext = {
      analysis: analysis as any,
      locale: 'en',
      insights: insights as any,
      traceabilityLinks: traceabilityLinks as any,
      reviewNotes,
      hasUnreviewedItems: false,
      dependencyEdges: [],
      clarifications: clarifications as any,
      reviewDecisions: [],
      reviewDecisionsSnapshot: reviewedSnapshot.reviewDecisionsSnapshot as any,
      evidenceQualitySummarySnapshot: reviewedSnapshot.evidenceQualitySummarySnapshot as any,
    };

    const currentHash = computeCanonicalReportHash(canonicalContext);
    
    if (localized.sourceContentHash !== currentHash) {
      return { status: 'OUT_OF_SYNC' };
    }

    return { status: 'READY' };
  }
}
