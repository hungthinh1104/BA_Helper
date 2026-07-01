import { Injectable } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { PrismaService } from "@ba-helper/backend-runtime";

@Injectable()
export class GetLatestReviewedReportSnapshotUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(analysisId: string) {
    const snapshot = await this.prisma.reviewedReportSnapshot.findFirst({
      where: { analysisId },
      orderBy: { createdAt: 'desc' },
    });

    if (!snapshot) {
      throw new AppError('NOT_FOUND' as any, 'Reviewed report snapshot not found');
    }

    return snapshot;
  }
}
