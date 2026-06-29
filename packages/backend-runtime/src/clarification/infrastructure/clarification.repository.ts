import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClarificationItem, Prisma } from '@prisma/client';;

@Injectable()
export class ClarificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ClarificationItem | null> {
    return this.prisma.clarificationItem.findUnique({
      where: { id },
    });
  }

  async findBySourceInsightId(sourceInsightId: string): Promise<ClarificationItem | null> {
    return this.prisma.clarificationItem.findUnique({
      where: { sourceInsightId },
    });
  }

  async listByAnalysisId(impactAnalysisId: string): Promise<ClarificationItem[]> {
    return this.prisma.clarificationItem.findMany({
      where: { impactAnalysisId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: Prisma.ClarificationItemUncheckedCreateInput): Promise<ClarificationItem> {
    return this.prisma.clarificationItem.create({ data });
  }

  async updateStatusAndAnswer(
    id: string,
    status: 'ANSWERED' | 'DISMISSED',
    answer: string | null = null,
    reason: string | null = null,
  ): Promise<ClarificationItem> {
    return this.prisma.clarificationItem.update({
      where: { id },
      data: { status, answer, reason },
    });
  }

  async markAsConverted(id: string, revisionId: string): Promise<ClarificationItem> {
    return this.prisma.clarificationItem.update({
      where: { id },
      data: { 
        status: 'CONVERTED_TO_REVISION',
        convertedRequirementRevisionId: revisionId,
      },
    });
  }
}
