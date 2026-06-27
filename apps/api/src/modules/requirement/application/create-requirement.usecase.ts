import type { RequirementRepository } from '../infrastructure/requirement.repository';
import { RequirementPolicy } from '../domain/requirement.policy';
import type { EventLogService } from '../../event-log/application/event-log.service';
import { AppError } from '@ba-helper/shared';
import type { ProjectRepository } from '../../project/infrastructure/project.repository';

export class CreateRequirementUseCase {
  constructor(
    private readonly repository: RequirementRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly eventLog: EventLogService,
  ) {}

  async execute(params: {
    projectId: string;
    title: string;
    rawText: string;
    submitForReadinessCheck: boolean;
  }) {
    RequirementPolicy.validateRevisionInput({
      title: params.title,
      rawText: params.rawText,
    });

    const project = await this.projectRepository.findById(params.projectId);
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 'Project not found.');
    }

    const requirement = await this.repository.createRequirement(params.projectId);

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

    await this.eventLog.recordEvent({
      eventType: 'REQUIREMENT_CREATED',
      idempotencyKey: `requirement:${requirement.id}:created`,
      payload: { requirementId: requirement.id, revisionId: revision.id },
    });

    return { requirement, revision, readiness };
  }
}
