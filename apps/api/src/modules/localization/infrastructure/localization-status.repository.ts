import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ba-helper/backend-runtime';
import type { SupportedReportLocale } from '@ba-helper/contracts';

@Injectable()
export class LocalizationStatusRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findApprovedDocumentId(analysisId: string): Promise<string | null> {
    const document = await this.prisma.generatedDocument.findUnique({
      where: {
        impactAnalysisId_type_status: {
          impactAnalysisId: analysisId,
          type: 'IMPACT_REPORT',
          status: 'APPROVED',
        },
      },
      select: { id: true },
    });
    return document?.id ?? null;
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
