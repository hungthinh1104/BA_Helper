import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalizedReportArtifact } from '@ba-helper/contracts';
import { Prisma } from '@prisma/client';

@Injectable()
export class LocalizedArtifactRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByDocumentAndLocale(sourceDocumentId: string, locale: string): Promise<LocalizedReportArtifact | null> {
    const record = await this.prisma.localizedReportArtifact.findUnique({
      where: {
        sourceDocumentId_locale: {
          sourceDocumentId,
          locale,
        },
      },
    });

    if (!record) return null;

    // Prisma enum mapping to Contract enum
    return record as unknown as LocalizedReportArtifact;
  }

  async upsert(data: {
    id?: string;
    sourceDocumentId: string;
    locale: string;
    sourceLocale: string;
    localizationStatus: 'QUEUED' | 'COMPLETED' | 'FAILED';
    contentMarkdown: string | null;
    sourceContentHash: string;
    glossaryVersion: string | null;
    provider: string | null;
    model: string | null;
    translationPromptVersion: string | null;
    structuralValidatorVersion: string | null;
    fieldPolicyVersion: string | null;
    errorCode: string | null;
  }): Promise<LocalizedReportArtifact> {
    const record = await this.prisma.localizedReportArtifact.upsert({
      where: {
        sourceDocumentId_locale: {
          sourceDocumentId: data.sourceDocumentId,
          locale: data.locale,
        },
      },
      update: data,
      create: data,
    });

    return record as unknown as LocalizedReportArtifact;
  }
}
