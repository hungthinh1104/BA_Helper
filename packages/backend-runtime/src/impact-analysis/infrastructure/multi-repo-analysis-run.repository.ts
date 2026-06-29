import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../index';;
import type { ResolvedDomainPackSelection } from '@ba-helper/contracts';

const MULTI_REPO_RUN_INCLUDE = {
  project: true,
  requirementRevision: true,
  createdByUser: true,
  approvedMergedReport: true,
  analyses: {
    include: {
      snapshot: {
        include: {
          repository: true,
        },
      },
      sourceTarget: true,
      requirementRevision: true,
      reviewDecisions: {
        include: {
          reviewedByUser: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
} as const;

const MULTI_REPO_RUN_LIST_INCLUDE = {
  requirementRevision: true,
  createdByUser: true,
  analyses: {
    select: {
      status: true,
    },
  },
} as const;

@Injectable()
export class MultiRepoAnalysisRunRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProjectRequestKey(projectId: string, requestKey: string) {
    return this.prisma.multiRepoAnalysisRun.findUnique({
      where: {
        projectId_requestKey: {
          projectId,
          requestKey,
        },
      },
      include: MULTI_REPO_RUN_INCLUDE,
    });
  }

  async findById(id: string) {
    return this.prisma.multiRepoAnalysisRun.findUnique({
      where: { id },
      include: MULTI_REPO_RUN_INCLUDE,
    });
  }

  async listByProject(projectId: string) {
    return this.prisma.multiRepoAnalysisRun.findMany({
      where: { projectId },
      include: MULTI_REPO_RUN_LIST_INCLUDE,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async create(params: {
    projectId: string;
    requirementRevisionId: string;
    createdByUserId: string;
    requestKey: string;
    selectedDomainPack?: ResolvedDomainPackSelection | null;
  }) {
    return this.prisma.multiRepoAnalysisRun.create({
      data: {
        projectId: params.projectId,
        requirementRevisionId: params.requirementRevisionId,
        createdByUserId: params.createdByUserId,
        requestKey: params.requestKey,
        ...(params.selectedDomainPack
          ? {
              requestedDomainPackId: params.selectedDomainPack.requestedDomainPackId,
              resolvedDomainPackId: params.selectedDomainPack.resolvedDomainPackId,
              resolvedDomainPackVersion:
                params.selectedDomainPack.resolvedDomainPackVersion,
              resolvedDomainPackStatus:
                params.selectedDomainPack.resolvedDomainPackStatus,
              domainPackSelectedBy: params.selectedDomainPack.selectedBy,
              domainPackResolvedAt: new Date(params.selectedDomainPack.resolvedAt),
            }
          : {}),
      },
      include: MULTI_REPO_RUN_INCLUDE,
    });
  }
}
