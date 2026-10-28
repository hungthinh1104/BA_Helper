import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from "@ba-helper/backend-runtime";

@Injectable()
export class RequirementRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createRequirement(params: {
    projectId: string;
    requestKey: string;
    requestPayloadHash: string;
  }, transaction?: Prisma.TransactionClient) {
    const client = transaction ?? this.prisma;
    return client.requirement.create({
      data: params,
    });
  }

  async findByProjectAndRequestKey(params: {
    projectId: string;
    requestKey: string;
  }) {
    return this.prisma.requirement.findUnique({
      where: {
        projectId_requestKey: {
          projectId: params.projectId,
          requestKey: params.requestKey,
        },
      },
      include: {
        revisions: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 1,
        },
      },
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
      select: {
        id: true,
        _count: { select: { revisions: true } },
        revisions: {
          select: {
            id: true,
            title: true,
            rawText: true,
            readinessStatus: true,
            validationIssues: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async createRevisionWithReadinessTransition(params: {
    requirementId: string;
    title: string;
    rawText: string;
    normalizedText: string;
    readinessStatus: 'DRAFT' | 'READY_FOR_ANALYSIS' | 'NEEDS_CLARIFICATION';
    validationIssues: string[];
  }, transaction?: Prisma.TransactionClient) {
    const createRevision = async (tx: Prisma.TransactionClient) => {
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
    };

    return transaction
      ? createRevision(transaction)
      : this.prisma.$transaction(createRevision);
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
