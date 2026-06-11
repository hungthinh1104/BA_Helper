import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByAnalysis(impactAnalysisId: string) {
    return this.prisma.generatedDocument.findMany({
      where: { impactAnalysisId },
      include: {
        impactAnalysis: {
          include: {
            snapshot: true,
            sourceTarget: true,
          },
        },
      },
    });
  }

  async upsertApproved(params: {
    impactAnalysisId: string;
    content: string;
  }) {
    return this.prisma.generatedDocument.upsert({
      where: {
        impactAnalysisId_type_status: {
          impactAnalysisId: params.impactAnalysisId,
          type: 'IMPACT_REPORT',
          status: 'APPROVED',
        },
      },
      update: {
        content: params.content,
      },
      create: {
        impactAnalysisId: params.impactAnalysisId,
        type: 'IMPACT_REPORT',
        status: 'APPROVED',
        content: params.content,
      },
    });
  }

  async findApprovedReportByAnalysisId(impactAnalysisId: string) {
    return this.prisma.generatedDocument.findUnique({
      where: {
        impactAnalysisId_type_status: {
          impactAnalysisId,
          type: 'IMPACT_REPORT',
          status: 'APPROVED',
        },
      },
      include: {
        impactAnalysis: {
          include: {
            snapshot: true,
            sourceTarget: true,
            requirementRevision: true,
          },
        },
      },
    });
  }
}
