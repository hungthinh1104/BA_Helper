import { RequirementRepository } from '../infrastructure/requirement.repository';
import { RequirementPolicy } from '../domain/requirement.policy';
import { EventLogService } from '../../event-log/application/event-log.service';
import { AppError } from '../../../shared/app-error';

export class CreateRequirementRevisionUseCase {
  constructor(
    private readonly repository: RequirementRepository,
    private readonly eventLog: EventLogService,
  ) {}

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

    const revision = await this.repository.createRevision({
      requirementId: requirement.id,
      title: params.title.trim(),
      rawText: params.rawText,
      normalizedText,
      readinessStatus: readiness.status,
      validationIssues: readiness.issues,
    });

    await this.eventLog.recordEvent({
      eventType: 'REQUIREMENT_REVISION_CREATED',
      idempotencyKey: `requirement:${requirement.id}:revision:${revision.id}`,
      payload: { requirementId: requirement.id, revisionId: revision.id },
    });

    return { requirement, revision, readiness };
  }
}
