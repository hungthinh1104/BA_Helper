import { Injectable } from '@nestjs/common';
import { ReviewClarificationRepository } from '../infrastructure/review-clarification.repository';
import { ImpactAnalysisRepository } from '../infrastructure/impact-analysis.repository';
import { AppError } from '../../../shared/app-error';
import { CreateImpactAnalysisUseCase } from './create-impact-analysis.usecase';
import { CreateRequirementRevisionUseCase } from '../../requirement/application/create-revision.usecase';
import * as crypto from 'crypto';

@Injectable()
export class CreateDerivedAnalysisFromClarificationUseCase {
  constructor(
    private readonly clarificationRepo: ReviewClarificationRepository,
    private readonly impactRepo: ImpactAnalysisRepository,
    private readonly createRevisionUseCase: CreateRequirementRevisionUseCase,
    private readonly createImpactAnalysisUseCase: CreateImpactAnalysisUseCase,
  ) {}

  async execute(clarificationId: string) {
    const clarification = await this.clarificationRepo.findById(clarificationId);

    if (!clarification) {
      throw new AppError('CLARIFICATION_NOT_FOUND', 'Clarification request not found.');
    }

    if (clarification.status !== 'ANSWERED' || !clarification.answer) {
      throw new AppError(
        'CLARIFICATION_NOT_ANSWERED',
        'Cannot create derived analysis from an unanswered clarification request.',
      );
    }

    // Check if derived analysis already exists (idempotency guard)
    const existingDerived = await this.impactRepo.findByReviewClarificationRequestId(clarificationId);
    if (existingDerived) {
      return existingDerived; // Idempotency
    }

    const originalAnalysis = await this.impactRepo.findById(clarification.analysisId);
    if (!originalAnalysis) {
      throw new AppError('ORIGINAL_ANALYSIS_NOT_FOUND', 'Original impact analysis not found.');
    }

    // 1. Construct Structured Addendum
    const addendum = `---

## Clarification Addendum

Source Analysis ID: ${originalAnalysis.id}
Review Decision ID: ${clarification.reviewDecisionId}
Clarification Request ID: ${clarification.id}
Clarification Status: ANSWERED
Created At: ${clarification.createdAt.toISOString()}
Answered At: ${clarification.answeredAt?.toISOString() || new Date().toISOString()}

### Clarification Question

${clarification.question.trim()}

### Stakeholder Answer

${clarification.answer.trim()}

### Interpretation Boundary

This addendum supplements the original requirement text. It does not replace the original requirement unless explicitly stated.

---`;

    const newRawText = [
      originalAnalysis.requirementRevision.rawText.trim(),
      addendum.trim(),
    ].join('\n\n');

    // 2. Create new requirement revision
    const newRevisionResult = await this.createRevisionUseCase.execute({
      requirementId: originalAnalysis.requirementRevision.requirementId,
      title: `${originalAnalysis.requirementRevision.title} (Clarified)`,
      rawText: newRawText,
      submitForReadinessCheck: true,
    });

    const newRevision = newRevisionResult.revision;

    // 3. Create derived impact analysis linked to clarification
    const newRequestKey = crypto.randomUUID();
    const derivedAnalysis = await this.createImpactAnalysisUseCase.execute({
      snapshotId: originalAnalysis.snapshotId,
      requirementRevisionId: newRevision.id,
      requestKey: newRequestKey,
      sourceTargetId: originalAnalysis.sourceTargetId,
      allowPartialSnapshot: originalAnalysis.acceptedPartialCoverage,
      derivedFromAnalysisId: originalAnalysis.id,
      reviewClarificationRequestId: clarificationId,
    });

    return derivedAnalysis;
  }
}
