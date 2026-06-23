import { Injectable } from '@nestjs/common';
import { ImpactAnalysisRepository } from '../../infrastructure/impact-analysis.repository';
import { ReviewDecisionRepository } from '../../infrastructure/review-decision.repository';
import { GetImpactDiffUseCase } from '../queries/get-impact-diff.usecase';
import { DocumentRepository } from '../../../document/infrastructure/document.repository';
import { InsightRepository } from '../../../insight/infrastructure/insight.repository';
import { TraceabilityRepository } from '../../../traceability/infrastructure/traceability.repository';
import { GraphRepository } from '../../../graph/infrastructure/graph.repository';
import { ReviewNoteRepository } from '../../infrastructure/review-note.repository';
import { ClarificationRepository } from '../../../clarification/infrastructure/clarification.repository';
import { CreateReviewedReportSnapshotUseCase } from '../../../document/application/create-reviewed-report-snapshot.usecase';
import { EnqueueDocumentJobUseCase } from '../../../document/application/enqueue-document-job.usecase';
import { AppError } from '../../../../shared/app-error';
import { AnalysisReviewDecisionValue } from '@prisma/client';
import { RequestUser } from '@ba-helper/contracts';

@Injectable()
export class CreateAnalysisReviewDecisionUseCase {
  constructor(
    private readonly impactRepo: ImpactAnalysisRepository,
    private readonly decisionRepo: ReviewDecisionRepository,
    private readonly getDiffUseCase: GetImpactDiffUseCase,
    private readonly insightRepo: InsightRepository,
    private readonly traceabilityRepo: TraceabilityRepository,
    private readonly graphRepo: GraphRepository,
    private readonly reviewNoteRepo: ReviewNoteRepository,
    private readonly clarificationRepo: ClarificationRepository,
    private readonly createSnapshot: CreateReviewedReportSnapshotUseCase,
    private readonly enqueueJob: EnqueueDocumentJobUseCase,
  ) {}

  async execute(params: {
    analysisId: string;
    decision: AnalysisReviewDecisionValue;
    note?: string;
    actor: RequestUser;
  }) {
    const analysis = await this.impactRepo.findById(params.analysisId);
    if (!analysis) {
      throw new AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Impact analysis not found.');
    }

    if (analysis.status !== 'COMPLETED') {
      throw new AppError(
        'INVALID_ANALYSIS_STATUS',
        'Only completed (finalized) analyses can be reviewed.'
      );
    }

    // If derived and accepted, diff must be computable
    if (analysis.derivedFromAnalysisId && params.decision === 'ACCEPTED') {
      const diffResult = await this.getDiffUseCase.computeForAnalysis(params.analysisId);
      if (!diffResult.computable) {
        throw new AppError(
          diffResult.reason || 'INTERNAL_DIFF_ERROR',
          `Cannot accept derived analysis because diff is not computable: ${diffResult.reason}`
        );
      }
    }

    // Step 1: Save immutable decision
    const decision = await this.decisionRepo.create({
      analysisId: params.analysisId,
      decision: params.decision,
      note: params.note,
      reviewedByUserId: params.actor.id,
    });

    // Step 2: Regenerate report outside database transaction
    // We now just create a new snapshot and enqueue a job.
    try {
      await this.createSnapshot.execute({
        analysisId: params.analysisId,
        createdByUserId: params.actor.id,
      });

      await this.enqueueJob.execute({
        analysisId: params.analysisId,
        documentType: 'IMPACT_REPORT',
      });

      return {
        decision,
        reportRegenerated: true,
      };
    } catch (e: any) {
      return {
        decision,
        reportRegenerated: false,
        reportRegenerationError: e.message || String(e),
      };
    }
  }
}
