import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MultiRepoMergedReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByRunId(runId: string) {
    return this.prisma.mergedMultiRepoReport.findUnique({
      where: { runId },
      include: {
        run: {
          include: {
            requirementRevision: true,
          },
        },
      },
    });
  }

  async upsertApproved(params: {
    runId: string;
    content: string;
    provenance: unknown;
  }) {
    return this.prisma.mergedMultiRepoReport.upsert({
      where: { runId: params.runId },
      update: {
        content: params.content,
        provenance: params.provenance as any,
      },
      create: {
        runId: params.runId,
        content: params.content,
        provenance: params.provenance as any,
      },
      include: {
        run: {
          include: {
            requirementRevision: true,
          },
        },
      },
    });
  }
}
