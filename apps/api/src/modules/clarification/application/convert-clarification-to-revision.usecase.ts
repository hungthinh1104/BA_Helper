import { Injectable } from '@nestjs/common';
import { ClarificationRepository } from '../infrastructure/clarification.repository';
import { ImpactAnalysisRepository } from '../../impact-analysis/infrastructure/impact-analysis.repository';
import { RequirementRepository } from '../../requirement/infrastructure/requirement.repository';
import { AppError } from '../../../shared/app-error';

@Injectable()
export class ConvertClarificationToRevisionUseCase {
  constructor(
    private readonly clarificationRepo: ClarificationRepository,
    private readonly impactRepo: ImpactAnalysisRepository,
    private readonly requirementRepo: RequirementRepository,
  ) {}

  async execute(clarificationId: string) {
    const clarification = await this.clarificationRepo.findById(clarificationId);
    if (!clarification) {
      throw new AppError('CLARIFICATION_NOT_FOUND', 'Clarification not found');
    }

    // 1. Idempotency Check
    if (clarification.status === 'CONVERTED_TO_REVISION') {
      return {
        clarificationId: clarification.id,
        revisionId: clarification.convertedRequirementRevisionId!,
        status: clarification.status,
      };
    }

    // 2. Validate state
    if (clarification.status !== 'ANSWERED') {
      throw new AppError('INVALID_CLARIFICATION_STATE', 'Only ANSWERED clarifications can be converted to requirement revisions');
    }

    if (!clarification.answer) {
      throw new AppError('INVALID_CLARIFICATION_STATE', 'Cannot convert clarification without an answer');
    }

    // 3. Fetch parent analysis and requirement
    const analysis = await this.impactRepo.findById(clarification.impactAnalysisId);
    if (!analysis) {
      throw new AppError('ANALYSIS_NOT_FOUND', 'Parent impact analysis not found');
    }

    const currentRevision = await this.requirementRepo.findRevisionById(analysis.requirementRevisionId);
    if (!currentRevision) {
      throw new AppError('REQUIREMENT_NOT_FOUND', 'Parent requirement revision not found');
    }

    // 4. Construct new rawText
    const newRawText = `${currentRevision.rawText}\n\n---\nClarification incorporated:\nQuestion: ${clarification.question}\nAnswer: ${clarification.answer}\nSource: Clarification ${clarification.id} from Analysis ${analysis.id}`;

    // 5. Create new revision
    const newRevision = await this.requirementRepo.createRevisionWithReadinessTransition({
      requirementId: currentRevision.requirementId,
      title: currentRevision.title,
      rawText: newRawText,
      normalizedText: newRawText,
      readinessStatus: 'READY_FOR_ANALYSIS',
      validationIssues: [],
    });

    // 6. Update clarification
    await this.clarificationRepo.markAsConverted(clarification.id, newRevision.id);

    return {
      clarificationId: clarification.id,
      revisionId: newRevision.id,
      requirementId: newRevision.requirementId,
      status: 'CONVERTED_TO_REVISION' as const,
    };
  }
}
