import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { RequirementRepository } from '../infrastructure/requirement.repository';
import { RequirementPolicy } from '../domain/requirement.policy';
import { AppError } from '@ba-helper/shared';
import type { ProjectRepository } from '../../project/infrastructure/project.repository';
import type { EventLogService, PrismaService } from "@ba-helper/backend-runtime";

export class CreateRequirementUseCase {
  constructor(
    private readonly repository: RequirementRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly eventLog: EventLogService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(params: {
    projectId: string;
    requestKey: string;
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

    const normalizedText = params.rawText.trim();
    const readiness = params.submitForReadinessCheck
      ? RequirementPolicy.qualifyReadiness(params.rawText)
      : { status: 'DRAFT' as const, issues: [] };
    const requestPayloadHash = createHash('sha256')
      .update(JSON.stringify({
        title: params.title.trim(),
        rawText: params.rawText,
        submitForReadinessCheck: params.submitForReadinessCheck,
      }))
      .digest('hex');
    const requestScope = {
      projectId: params.projectId,
      requestKey: params.requestKey,
    };

    const existing = await this.repository.findByProjectAndRequestKey(requestScope);
    if (existing) {
      return this.replay(existing, requestPayloadHash, readiness);
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const requirement = await this.repository.createRequirement({
          ...requestScope,
          requestPayloadHash,
        }, transaction);
        const revision = await this.repository.createRevisionWithReadinessTransition({
          requirementId: requirement.id,
          title: params.title.trim(),
          rawText: params.rawText,
          normalizedText,
          readinessStatus: readiness.status,
          validationIssues: readiness.issues,
        }, transaction);

        await this.eventLog.recordEvent({
          eventType: 'REQUIREMENT_CREATED',
          idempotencyKey: `requirement:${requirement.id}:created`,
          payload: { requirementId: requirement.id, revisionId: revision.id },
        }, transaction);

        return { requirement, revision, readiness };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existingAfterRace = await this.repository.findByProjectAndRequestKey(requestScope);
        if (existingAfterRace) {
          return this.replay(existingAfterRace, requestPayloadHash, readiness);
        }
      }
      throw error;
    }
  }

  private replay(
    existing: NonNullable<Awaited<ReturnType<RequirementRepository['findByProjectAndRequestKey']>>>,
    requestPayloadHash: string,
    readiness: ReturnType<typeof RequirementPolicy.qualifyReadiness> | { status: 'DRAFT'; issues: never[] },
  ) {
    if (existing.requestPayloadHash !== requestPayloadHash) {
      throw new AppError(
        'REQUEST_KEY_MISMATCH',
        'Request key reuse with different payload.',
      );
    }

    const revision = existing.revisions[0];
    if (!revision) {
      throw new AppError(
        'REQUEST_KEY_MISMATCH',
        'Request key belongs to a requirement without an initial revision.',
      );
    }
    return { requirement: existing, revision, readiness };
  }
}
