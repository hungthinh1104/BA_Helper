import { Controller, Post, Get, Param, Body, UseGuards, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ReportLocalizationService, MarkdownReportRenderContext } from '@ba-helper/backend-runtime';
import { GenerateLocalizedReportRequest, generateLocalizedReportRequestSchema, LocalizedReportArtifact } from '@ba-helper/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { RolesGuard } from '../auth/application/roles.guard';
import { JwtAuthGuard } from '../auth/application/jwt-auth.guard';

@Controller('api/v1/analyses/:analysisId/localization')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocalizationController {
  constructor(
    private readonly localizationService: ReportLocalizationService,
    private readonly prisma: PrismaService,
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
}
