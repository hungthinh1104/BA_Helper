import { RequirementRepository } from '../infrastructure/requirement.repository';
import { RequirementPolicy } from '../domain/requirement.policy';
import { AppError } from '@ba-helper/shared';

export class QualifyRequirementRevisionUseCase {
  constructor(private readonly repository: RequirementRepository) {}

  async execute(params: { revisionId: string }) {
    const revision = await this.repository.findRevisionById(params.revisionId);
    if (!revision) {
      throw new AppError(
        'REQUIREMENT_REVISION_NOT_FOUND',
        'Requirement revision not found.',
      );
    }

    const readiness = RequirementPolicy.qualifyReadiness(revision.rawText);

    const updated = await this.repository.qualifyRevisionWithReadinessTransition({
      revisionId: revision.id,
      requirementId: revision.requirementId,
      readinessStatus: readiness.status,
      validationIssues: readiness.issues,
    });

    return { revision: updated, readiness };
  }
}
