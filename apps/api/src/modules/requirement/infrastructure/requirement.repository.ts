import { Injectable } from '@nestjs/common';
import { PrismaService } from "@ba-helper/backend-runtime";

@Injectable()
export class RequirementRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createRequirement(projectId: string) {
    return this.prisma.requirement.create({
      data: { projectId },
    });
  }

  async findRequirementById(id: string) {
    return this.prisma.requirement.findUnique({
      where: { id },
      include: {
        revisions: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async findByProject(projectId: string) {
    return this.prisma.requirement.findMany({
      where: { projectId },
      include: {
        revisions: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRevisionWithReadinessTransition(params: {
    requirementId: string;
    title: string;
    rawText: string;
    normalizedText: string;
    readinessStatus: 'DRAFT' | 'READY_FOR_ANALYSIS' | 'NEEDS_CLARIFICATION';
    validationIssues: string[];
  }) {
    return this.prisma.$transaction(async (tx) => {
      const revision = await tx.requirementRevision.create({
        data: {
          requirementId: params.requirementId,
          title: params.title,
          rawText: params.rawText,
          normalizedText: params.normalizedText,
          readinessStatus: params.readinessStatus,
          validationIssues: params.validationIssues,
        },
      });

      if (revision.readinessStatus === 'READY_FOR_ANALYSIS') {
        await tx.requirementRevision.updateMany({
          where: {
            requirementId: params.requirementId,
            id: { not: revision.id },
            readinessStatus: 'READY_FOR_ANALYSIS',
          },
          data: {
            readinessStatus: 'ARCHIVED',
          },
        });
      }

      await tx.domainEvent.create({
        data: {
          eventType: 'REQUIREMENT_REVISION_CREATED',
          idempotencyKey: `requirement:${params.requirementId}:revision:${revision.id}`,
          payload: { requirementId: params.requirementId, revisionId: revision.id },
        },
      });

      return revision;
    });
  }

  async qualifyRevisionWithReadinessTransition(params: {
    revisionId: string;
    requirementId: string;
    readinessStatus: 'READY_FOR_ANALYSIS' | 'NEEDS_CLARIFICATION' | 'ARCHIVED';
    validationIssues: string[];
  }) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.requirementRevision.update({
        where: { id: params.revisionId },
        data: {
          readinessStatus: params.readinessStatus,
          validationIssues: params.validationIssues,
        },
      });

      if (params.readinessStatus === 'READY_FOR_ANALYSIS') {
        await tx.requirementRevision.updateMany({
          where: {
            requirementId: params.requirementId,
            id: { not: params.revisionId },
            readinessStatus: 'READY_FOR_ANALYSIS',
          },
          data: {
            readinessStatus: 'ARCHIVED',
          },
        });
      }

      await tx.domainEvent.create({
        data: {
          eventType: 'REQUIREMENT_REVISION_QUALIFIED',
          idempotencyKey: `requirement:${params.requirementId}:qualified:${params.revisionId}`,
          payload: { revisionId: params.revisionId, readinessStatus: params.readinessStatus },
        },
      });

      return updated;
    });
  }

  async findRevisionById(id: string) {
    return this.prisma.requirementRevision.findUnique({
      where: { id },
    });
  }
}
