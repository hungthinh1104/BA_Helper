import { PrismaService } from '../../prisma/prisma.service';

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
}
