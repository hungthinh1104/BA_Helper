import type { EvidenceRepository } from '../infrastructure/evidence.repository';
import type { PrismaService } from '../../prisma/prisma.service';
import { AppError } from '@ba-helper/shared';

export class ListEvidenceUseCase {
  constructor(
    private readonly repository: EvidenceRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(impactAnalysisId: string) {
    const analysis = await this.prisma.impactAnalysis.findUnique({
      where: { id: impactAnalysisId },
      include: { snapshot: true, requirementRevision: true },
    });

    if (!analysis) {
      throw new AppError(
        'IMPACT_ANALYSIS_NOT_FOUND',
        'Impact analysis not found.',
      );
    }

    return this.repository.listByAnalysis({
      snapshotId: analysis.snapshot.id,
      revisionId: analysis.requirementRevision.id,
    });
  }
}
