import { Injectable } from '@nestjs/common';
import { ReviewCompletionResponse } from '@ba-helper/contracts';
import { AppError } from '@ba-helper/shared';
import { buildEvidenceQualityProjection } from '../../document/application/evidence-quality.projection';
import {
  buildReportApprovalGateItems,
  ReportApprovalGatePolicy,
  type ReportApprovalBlockerCode,
} from '../../document/application/report-approval-gate.policy';
import { PrismaService, TraceabilityRepository, InsightRepository } from "@ba-helper/backend-runtime";

@Injectable()
export class GetReviewCompletionUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: TraceabilityRepository,
    private readonly insightRepository: InsightRepository,
  ) {}

  async execute(analysisId: string): Promise<ReviewCompletionResponse> {
    const analysis = await this.prisma.impactAnalysis.findUnique({
      where: { id: analysisId },
    });
    
    if (!analysis) {
      throw new AppError('NOT_FOUND' as any, 'Analysis not found');
    }

    const links = await this.repository.listByAnalysis(analysisId);
    const insights = await this.insightRepository.listByAnalysis(analysisId);
    const totalLinks = links.length;

    let accepted = 0;
    let rejected = 0;
    let needsReview = 0;
    let needsMoreEvidence = 0;
    let unreviewed = 0;

    for (const link of links) {
      const decision = link.reviewDecision?.decision ?? link.reviewStatus;
      if (decision === 'ACCEPTED' || decision === 'CONFIRMED') accepted++;
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
    const blockingReasons: Array<
      'UNREVIEWED_TRACEABILITY_LINKS' |
      'REVIEWED_SNAPSHOT_MISSING' |
      ReportApprovalBlockerCode
    > = [];

    if (needsReview > 0 || unreviewed > 0) {
      isComplete = false;
      blockingReasons.push('UNREVIEWED_TRACEABILITY_LINKS');
    }

    if (!hasReviewedSnapshot) {
      isComplete = false;
      blockingReasons.push('REVIEWED_SNAPSHOT_MISSING');
    }

    const qualityProjection = buildEvidenceQualityProjection({
      traceabilityLinks: links,
      insights: insights as any[],
    });
    const approvalGate = ReportApprovalGatePolicy.evaluate(buildReportApprovalGateItems({
      items: qualityProjection.items,
      insights,
      traceabilityLinks: links,
    }));
    if (!approvalGate.canApprove) {
      isComplete = false;
      blockingReasons.push(...approvalGate.blockingReasons);
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
      blockingReasons: Array.from(new Set(blockingReasons)),
    };
  }
}
