import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AppError } from '../../../../shared/app-error';

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
