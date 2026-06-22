import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TraceabilityRepository } from '../infrastructure/traceability.repository';
import { ReviewCompletionResponse } from '@ba-helper/contracts';
import { AppError } from '../../../shared/app-error';

@Injectable()
export class GetReviewCompletionUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: TraceabilityRepository,
  ) {}

  async execute(analysisId: string): Promise<ReviewCompletionResponse> {
    const analysis = await this.prisma.impactAnalysis.findUnique({
      where: { id: analysisId },
    });
    
    if (!analysis) {
      throw new AppError('NOT_FOUND' as any, 'Analysis not found');
    }

    const links = await this.repository.listByAnalysis(analysisId);
    const totalLinks = links.length;

    let accepted = 0;
    let rejected = 0;
    let needsReview = 0;
    let needsMoreEvidence = 0;
    let unreviewed = 0;

    for (const link of links) {
      const decision = link.reviewDecision?.decision;
      if (decision === 'ACCEPTED') accepted++;
      else if (decision === 'REJECTED') rejected++;
      else if (decision === 'NEEDS_REVIEW') needsReview++;
      else if (decision === 'NEEDS_MORE_EVIDENCE') needsMoreEvidence++;
      else unreviewed++;
    }

    const latestSnapshot = await this.prisma.reviewedReportSnapshot.findFirst({
      where: { analysisId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    const hasReviewedSnapshot = !!latestSnapshot;
    
    let isComplete = true;
    const blockingReasons: Array<'UNREVIEWED_TRACEABILITY_LINKS' | 'REVIEWED_SNAPSHOT_MISSING'> = [];

    if (totalLinks === 0) {
      // Technically no unreviewed links, but it makes sense to not be complete if there are no links.
      // However, to keep it simple as per spec: isComplete = false, UNREVIEWED_TRACEABILITY_LINKS
      isComplete = false;
      blockingReasons.push('UNREVIEWED_TRACEABILITY_LINKS');
    } else if (unreviewed > 0) {
      isComplete = false;
      blockingReasons.push('UNREVIEWED_TRACEABILITY_LINKS');
    }

    if (!hasReviewedSnapshot) {
      isComplete = false;
      blockingReasons.push('REVIEWED_SNAPSHOT_MISSING');
    }

    // Double check invariant
    if (totalLinks > 0) {
      const totalDecisions = accepted + rejected + needsReview + needsMoreEvidence + unreviewed;
      if (totalLinks !== totalDecisions) {
        throw new Error('Invariant violation: totalLinks mismatch');
      }
    }

    return {
      analysisId,
      totalLinks,
      accepted,
      rejected,
      needsReview,
      needsMoreEvidence,
      unreviewed,
      isComplete,
      hasReviewedSnapshot,
      latestSnapshotId: latestSnapshot?.id || null,
      blockingReasons,
    };
  }
}
