import { Injectable } from '@nestjs/common';
import { CreateReviewNoteRequest } from '@ba-helper/contracts';
import { ReviewNoteRepository } from '../../infrastructure/review-note.repository';
import { ImpactAnalysisRepository } from '../../infrastructure/impact-analysis.repository';
import { InsightRepository } from '../../../insight/infrastructure/insight.repository';
import { TraceabilityRepository } from '../../../traceability/infrastructure/traceability.repository';
import { AppError } from '../../../../shared/app-error';

@Injectable()
export class SaveReviewNoteUseCase {
  constructor(
    private readonly reviewNoteRepo: ReviewNoteRepository,
    private readonly impactAnalysisRepo: ImpactAnalysisRepository,
    private readonly insightRepo: InsightRepository,
    private readonly traceabilityRepo: TraceabilityRepository,
  ) {}

  async execute(analysisId: string, request: CreateReviewNoteRequest) {
    const analysis = await this.impactAnalysisRepo.findById(analysisId);
    if (!analysis) {
      throw new AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Analysis not found');
    }

    if (analysis.status === 'COMPLETED') {
      throw new AppError(
        'INVALID_STATE_TRANSITION',
        'Cannot edit review notes after analysis is finalized',
      );
    }

    const hasInsight = Boolean(request.insightId);
    const hasLink = Boolean(request.traceabilityLinkId);
    if (hasInsight === hasLink) {
      throw new AppError(
        'REVIEW_NOTE_TARGET_MISMATCH',
        'Provide exactly one of insightId or traceabilityLinkId.',
      );
    }

    if (request.insightId) {
      const insight = await this.insightRepo.findById(request.insightId);
      if (!insight) {
        throw new AppError('INVALID_REVIEW_NOTE_TARGET', 'Insight not found');
      }
      if (insight.impactAnalysisId !== analysisId) {
        throw new AppError(
          'REVIEW_NOTE_TARGET_MISMATCH',
          'Insight does not belong to this analysis',
        );
      }
    }

    if (request.traceabilityLinkId) {
      const link = await this.traceabilityRepo.findById(request.traceabilityLinkId);
      if (!link) {
        throw new AppError('INVALID_REVIEW_NOTE_TARGET', 'Traceability link not found');
      }
      if (link.impactAnalysisId !== analysisId) {
        throw new AppError(
          'REVIEW_NOTE_TARGET_MISMATCH',
          'Traceability link does not belong to this analysis',
        );
      }
    }

    return this.reviewNoteRepo.upsert({
      impactAnalysisId: analysisId,
      insightId: request.insightId ?? undefined,
      traceabilityLinkId: request.traceabilityLinkId ?? undefined,
      body: request.body,
    });
  }
}
