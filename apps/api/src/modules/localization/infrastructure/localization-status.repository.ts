import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ba-helper/backend-runtime';
import type { SupportedReportLocale } from '@ba-helper/contracts';

@Injectable()
export class LocalizationStatusRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findApprovedDocumentId(analysisId: string): Promise<string | null> {
    const latestSnapshot = await this.prisma.reviewedReportSnapshot.findFirst({
      where: { analysisId },
      orderBy: { createdAt: 'desc' },
      select: { approvedDocumentId: true },
    });
    if (latestSnapshot) return latestSnapshot.approvedDocumentId;

    const legacyDocument = await this.prisma.generatedDocument.findFirst({
      where: { impactAnalysisId: analysisId, type: 'IMPACT_REPORT', status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return legacyDocument?.id ?? null;
  }

  async findArtifact(sourceDocumentId: string, locale: SupportedReportLocale) {
    return this.prisma.localizedReportArtifact.findUnique({
      where: { sourceDocumentId_locale: { sourceDocumentId, locale } },
      select: {
        localizationStatus: true,
        errorCode: true,
        updatedAt: true,
        sourceContentHash: true,
      },
    });
  }
}
