import { Injectable } from '@nestjs/common';
import { ClarificationRepository } from '../infrastructure/clarification.repository';
import { ImpactAnalysisRepository } from '../../impact-analysis/infrastructure/impact-analysis.repository';
import { InsightRepository } from '../../insight/infrastructure/insight.repository';
import { AppError } from '../../../shared/app-error';

@Injectable()
export class EnsureClarificationUseCase {
  constructor(
    private readonly clarificationRepo: ClarificationRepository,
    private readonly insightRepo: InsightRepository,
    private readonly impactRepo: ImpactAnalysisRepository,
  ) {}

  async execute(analysisId: string, sourceInsightId: string) {
    // 1. Validate insight exists and belongs to analysis
    const insight = await this.insightRepo.findById(sourceInsightId);
    if (!insight) {
      throw new AppError('INSIGHT_NOT_FOUND', 'Insight not found');
    }
    if (insight.impactAnalysisId !== analysisId) {
      throw new AppError('INVALID_INSIGHT', 'Insight does not belong to this analysis');
    }

    // 2. Validate insight category
    if (insight.insightType !== 'UNKNOWN' && insight.insightType !== 'QUESTION') {
      throw new AppError(
        'INVALID_CLARIFICATION_SOURCE',
        'Clarifications can only be created from UNKNOWN or QUESTION insights',
      );
    }

    // 3. Validate analysis status
    const analysis = await this.impactRepo.findById(analysisId);
    if (!analysis) {
      throw new AppError('ANALYSIS_NOT_FOUND', 'Analysis not found');
    }
    if (analysis.status === 'COMPLETED') {
      throw new AppError(
        'ANALYSIS_ALREADY_COMPLETED',
        'Cannot create clarification for a completed analysis',
      );
    }

    // 4. Check for existing (idempotency)
    const existing = await this.clarificationRepo.findBySourceInsightId(sourceInsightId);
    if (existing) {
      return existing;
    }

    // 5. Derive question/reason from insight
    const question = insight.title; // MVP: using title as question
    const reason = insight.reasoning || insight.description;

    // 6. Create new clarification item
    return this.clarificationRepo.create({
      impactAnalysisId: analysisId,
      sourceInsightId,
      question,
      reason,
      status: 'OPEN',
    });
  }
}
