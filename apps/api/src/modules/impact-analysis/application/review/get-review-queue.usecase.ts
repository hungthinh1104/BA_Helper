import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { ReviewQueueResponse, ReviewQueueItem, QaCoverageSeverity } from '@ba-helper/contracts';
import { ImpactGraphReadModelBuilder } from '../queries/impact-graph-read-model.builder';
import { QaCoverageDeriver } from '../qa/qa-coverage.deriver';
import { InsightRepository } from '../../../insight/infrastructure/insight.repository';
import { TraceabilityRepository } from '../../../traceability/infrastructure/traceability.repository';

@Injectable()
export class GetReviewQueueUseCase {
  private readonly logger = new Logger(GetReviewQueueUseCase.name);

  constructor(
    private readonly graphBuilder: ImpactGraphReadModelBuilder,
    private readonly qaCoverageDeriver: QaCoverageDeriver,
    private readonly insightRepo: InsightRepository,
    private readonly traceabilityRepo: TraceabilityRepository,
  ) {}

  async execute(analysisId: string): Promise<ReviewQueueResponse> {
    const graphData = await this.graphBuilder.buildGraph(analysisId);
    if (!graphData) {
      throw new AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Could not build graph for analysis');
    }

    const qaCoverage = this.qaCoverageDeriver.derive(analysisId, graphData);
    const insights = await this.insightRepo.listByAnalysis(analysisId);
    const traceabilityLinks = await this.traceabilityRepo.listByAnalysis(analysisId);

    const queueItems: ReviewQueueItem[] = [];
    let highRiskRemaining = 0;
    let blockingRemaining = 0;
    let decisionRequiredRemaining = 0;
    let diagnosticRemaining = 0;

    // 1. Process Insights
    for (const insight of insights) {
      if (insight.reviewStatus === 'CONFIRMED' || insight.reviewStatus === 'REJECTED') {
        continue;
      }

      const retrieval = insight.evidenceLinks?.[0]?.evidence?.retrievalMetadata as any;
      const confidence = retrieval?.suggestion?.confidence || 'UNKNOWN';

      let rank = 30; // LOW
      let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      let priorityReason = 'Low severity item';
      
      let type: 'INSIGHT' | 'UNKNOWN' = 'INSIGHT';
      let requiresDecision = true;
      let blockingFinalize = true;

      if (insight.insightType === 'UNKNOWN') {
        rank = 90;
        priority = 'HIGH';
        priorityReason = 'UNKNOWN business rule requires clarification';
        type = 'UNKNOWN';
      } else if (insight.certainty === 'EVIDENCED' && confidence === 'STRONG') {
        rank = 80;
        priority = 'HIGH';
        priorityReason = 'EVIDENCED insight with strong impact';
      } else if (confidence === 'MODERATE') {
        rank = 70;
        priority = 'MEDIUM';
        priorityReason = 'Moderate confidence retrieval (hybrid/vector)';
      }

      const item: ReviewQueueItem = {
        id: insight.id,
        type,
        source: 'INSIGHT',
        priority,
        title: insight.title,
        reason: insight.description,
        rank,
        priorityReason,
        linkedInsightId: insight.id,
        evidenceIds: insight.evidenceLinks?.map(l => l.evidenceId) || [],
        suggestedAction: retrieval?.suggestion?.suggestedAction,
        qaFocus: retrieval?.suggestion?.qaFocus,
        risk: retrieval?.suggestion?.risk,
        reviewStatus: insight.reviewStatus as any,
        requiresDecision,
        blockingFinalize,
      };

      queueItems.push(item);
      blockingRemaining++;
      decisionRequiredRemaining++;
      if (priority === 'HIGH') highRiskRemaining++;
    }

    // 2. Process Traceability Links
    for (const link of traceabilityLinks) {
      if (link.reviewStatus === 'CONFIRMED' || link.reviewStatus === 'REJECTED') {
        continue;
      }

      const retrieval = link.retrievalMetadata as any;
      const confidence = retrieval?.suggestion?.confidence || 'UNKNOWN';

      let rank = 30;
      let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      let priorityReason = 'Low severity item';

      if (confidence === 'STRONG') {
        rank = 80;
        priority = 'HIGH';
        priorityReason = 'EVIDENCED artifact link with strong impact';
      } else if (confidence === 'MODERATE') {
        rank = 70;
        priority = 'MEDIUM';
        priorityReason = 'Moderate confidence retrieval';
      }

      const artifactLabel =
        link.artifact?.name ||
        link.artifact?.artifactKey ||
        link.artifact?.filePath ||
        link.artifactId;

      const item: ReviewQueueItem = {
        id: link.id,
        type: 'TRACEABILITY_LINK',
        source: 'TRACEABILITY',
        priority,
        title: `Review impact link: ${artifactLabel}`,
        reason: `Traced via ${link.linkType} to ${link.artifact?.filePath || artifactLabel}`,
        rank,
        priorityReason,
        linkedTraceabilityLinkId: link.id,
        linkedArtifactId: link.artifactId,
        evidenceIds: link.evidenceLinks?.map(l => l.evidenceId) || [],
        suggestedAction: retrieval?.suggestion?.suggestedAction,
        qaFocus: retrieval?.suggestion?.qaFocus,
        risk: retrieval?.suggestion?.risk,
        reviewStatus: link.reviewStatus as any,
        requiresDecision: true,
        blockingFinalize: true,
      };

      queueItems.push(item);
      blockingRemaining++;
      decisionRequiredRemaining++;
      if (priority === 'HIGH') highRiskRemaining++;
    }

    // 3. Process QA Coverage Gaps
    for (const gap of qaCoverage.items) {
      if (gap.status === 'COVERED') continue;

      let rank = 30;
      let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      let priorityReason = 'Low severity gap';
      let type: 'QA_COVERAGE_GAP' | 'QA_SCENARIO' = 'QA_COVERAGE_GAP';

      if (gap.severity === 'HIGH') {
        rank = 100;
        priority = 'HIGH';
        priorityReason = 'High severity QA coverage gap';
      } else if (gap.severity === 'MEDIUM') {
        rank = 60;
        priority = 'MEDIUM';
        priorityReason = 'QA scenario';
        type = 'QA_SCENARIO';
      }

      // QA Coverage items are currently diagnostic only in MVP
      const requiresDecision = false;
      const blockingFinalize = false;

      const item: ReviewQueueItem = {
        id: `qa-gap-${gap.artifactId}`,
        type,
        source: 'QA_COVERAGE',
        priority,
        title: `Coverage gap on ${gap.artifactLabel}`,
        reason: gap.reason,
        rank,
        priorityReason,
        linkedArtifactId: gap.artifactId,
        suggestedAction: gap.suggestedAction,
        reviewStatus: 'NEEDS_REVIEW',
        requiresDecision,
        blockingFinalize,
      };

      queueItems.push(item);
      diagnosticRemaining++;
      if (priority === 'HIGH') highRiskRemaining++;
    }

    // 4. Sort deterministic ranking
    queueItems.sort((a, b) => b.rank - a.rank);

    return {
      analysisId,
      summary: {
        total: queueItems.length,
        remaining: decisionRequiredRemaining,
        totalActiveItems: queueItems.length,
        decisionRequiredRemaining,
        diagnosticRemaining,
        blockingRemaining,
        highRiskRemaining,
      },
      items: queueItems,
    };
  }
}
