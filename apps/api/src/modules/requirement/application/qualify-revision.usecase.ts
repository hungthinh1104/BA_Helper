import { RequirementRepository } from '../infrastructure/requirement.repository';
import { RequirementPolicy } from '../domain/requirement.policy';
import { EventLogService } from '../../event-log/application/event-log.service';
import { AppError } from '../../../shared/app-error';

export class QualifyRequirementRevisionUseCase {
  constructor(
    private readonly repository: RequirementRepository,
    private readonly eventLog: EventLogService,
  ) {}

  async execute(params: { revisionId: string }) {
    const revision = await this.repository.findRevisionById(params.revisionId);
    if (!revision) {
      throw new AppError(
        'REQUIREMENT_REVISION_NOT_FOUND',
        'Requirement revision not found.',
      );
    }

    const readiness = RequirementPolicy.qualifyReadiness(revision.rawText);

    const updated = await this.repository.updateRevisionStatus({
      revisionId: revision.id,
      readinessStatus: readiness.status,
      validationIssues: readiness.issues,
    });

    await this.eventLog.recordEvent({
      eventType: 'REQUIREMENT_REVISION_QUALIFIED',
      idempotencyKey: `requirement:${revision.requirementId}:qualified:${revision.id}`,
      payload: { revisionId: revision.id, readinessStatus: readiness.status },
    });

    return { revision: updated, readiness };
  }
}
