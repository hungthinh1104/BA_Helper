import type { RequirementRepository } from '../infrastructure/requirement.repository';
import { RequirementPolicy } from '../domain/requirement.policy';
import { AppError } from '@ba-helper/shared';

export class CreateRequirementRevisionUseCase {
  constructor(private readonly repository: RequirementRepository) {}

  async execute(params: {
    requirementId: string;
    title: string;
    rawText: string;
    submitForReadinessCheck: boolean;
  }) {
    const requirement = await this.repository.findRequirementById(
      params.requirementId,
    );
    if (!requirement) {
      throw new AppError('REQUIREMENT_NOT_FOUND', 'Requirement not found.');
    }

    RequirementPolicy.validateRevisionInput({
      title: params.title,
      rawText: params.rawText,
    });

    const normalizedText = params.rawText.trim();
    const readiness = params.submitForReadinessCheck
      ? RequirementPolicy.qualifyReadiness(params.rawText)
      : { status: 'DRAFT' as const, issues: [] };

    const revision = await this.repository.createRevisionWithReadinessTransition({
      requirementId: requirement.id,
      title: params.title.trim(),
      rawText: params.rawText,
      normalizedText,
      readinessStatus: readiness.status,
      validationIssues: readiness.issues,
    });

    return { requirement, revision, readiness };
  }
}
