import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ImpactAnalysisMetadata } from '../domain/impact-analysis.types';

const IMPACT_ANALYSIS_INCLUDE = {
  snapshot: {
    include: {
      repository: true,
      profile: true,
    },
  },
  sourceTarget: true,
  requirementRevision: {
    include: {
      requirement: true,
    },
  },
  insights: true,
  multiRepoRun: true,
} as const;

@Injectable()
export class ImpactAnalysisRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.impactAnalysis.findUnique({
      where: { id },
      include: IMPACT_ANALYSIS_INCLUDE,
    });
  }

  async findByReviewClarificationRequestId(reviewClarificationRequestId: string) {
    return this.prisma.impactAnalysis.findFirst({
      where: { reviewClarificationRequestId },
      include: IMPACT_ANALYSIS_INCLUDE,
    });
  }

  async updateTraceabilityLineage(
    id: string,
    data: { derivedFromAnalysisId: string; reviewClarificationRequestId: string }
  ) {
    return this.prisma.impactAnalysis.update({
      where: { id },
      data,
      include: IMPACT_ANALYSIS_INCLUDE,
    });
  }

  async findByProject(projectId: string, limit?: number, offset?: number) {
    return this.prisma.impactAnalysis.findMany({
      where: {
        AND: [
          {
            requirementRevision: {
              requirement: {
                projectId,
              },
            },
          },
          {
            snapshot: {
              repository: {
                projectId,
              },
            },
          },
        ],
      },
      take: limit,
      skip: offset,
      include: {
        snapshot: {
          include: {
            repository: true,
          },
        },
        sourceTarget: true,
        requirementRevision: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByComposite(params: {
    requirementRevisionId: string;
    snapshotId: string;
    sourceTargetId: string;
    requestKey: string;
  }) {
    return this.prisma.impactAnalysis.findUnique({
      where: {
        requirementRevisionId_snapshotId_sourceTargetId_requestKey: {
          requirementRevisionId: params.requirementRevisionId,
          snapshotId: params.snapshotId,
          sourceTargetId: params.sourceTargetId,
          requestKey: params.requestKey,
        },
      },
      include: {
        snapshot: true,
        sourceTarget: true,
        requirementRevision: true,
      },
    });
  }

  async findByRequestKey(params: {
    requestKey: string;
  }) {
    return this.prisma.impactAnalysis.findFirst({
      where: {
        requestKey: params.requestKey,
      },
    });
  }

  async createQueued(params: {
    requirementRevisionId: string;
    snapshotId: string;
    sourceTargetId: string;
    multiRepoRunId?: string | null;
    requestKey: string;
    acceptedPartialCoverage: boolean;
    coverageWarning?: string | null;
    derivedFromAnalysisId?: string | null;
    sourceClarificationId?: string | null;
    reviewClarificationRequestId?: string | null;
  }) {
    return this.prisma.impactAnalysis.create({
      data: {
        requirementRevisionId: params.requirementRevisionId,
        snapshotId: params.snapshotId,
        sourceTargetId: params.sourceTargetId,
        multiRepoRunId: params.multiRepoRunId ?? null,
        requestKey: params.requestKey,
        status: 'QUEUED',
        stage: 'WAITING',
        progress: 0,
        acceptedPartialCoverage: params.acceptedPartialCoverage,
        coverageWarning: params.coverageWarning ?? null,
        derivedFromAnalysisId: params.derivedFromAnalysisId,
        sourceClarificationId: params.sourceClarificationId,
        reviewClarificationRequestId: params.reviewClarificationRequestId,
      },
      include: IMPACT_ANALYSIS_INCLUDE,
    });
  }

  async attachToMultiRepoRun(analysisId: string, multiRepoRunId: string) {
    return this.prisma.impactAnalysis.update({
      where: { id: analysisId },
      data: {
        multiRepoRunId,
      },
      include: IMPACT_ANALYSIS_INCLUDE,
    });
  }

  async updateStatus(params: {
    id: string;
    status: 'COMPLETED' | 'WAITING_FOR_REVIEW' | 'FAILED' | 'CANCELLED' | 'RUNNING' | 'QUEUED';
    stage: 'WAITING' | 'RETRIEVING_EVIDENCE' | 'EXPANDING_GRAPH' | 'RUNNING_AI_REASONING' | 'GENERATING_INSIGHTS' | 'GENERATING_DOCUMENTS' | 'DONE';
    progress: number;
    metadata?: ImpactAnalysisMetadata;
    error?: any;
  }) {
    return this.prisma.impactAnalysis.update({
      where: { id: params.id },
      data: {
        status: params.status,
        stage: params.stage,
        progress: params.progress,
        ...(params.metadata ? { metadata: params.metadata as any } : {}),
        ...(params.error ? { error: params.error as any } : {}),
      },
      include: {
        snapshot: true,
        sourceTarget: true,
        requirementRevision: true,
        insights: true,
      },
    });
  }

  async finalizeIfCurrent(params: {
    analysisId: string;
    status: 'COMPLETED';
    stage: 'DONE';
    progress: number;
    expectedCommitSha: string;
    expectedTargetCommitSha: string;
    expectedResolvedRefType: 'BRANCH' | 'TAG' | 'COMMIT';
  }) {
    return this.prisma.impactAnalysis.updateMany({
      where: {
        id: params.analysisId,
        snapshot: {
          commitSha: params.expectedCommitSha,
        },
        sourceTarget: {
          resolvedRefType: params.expectedResolvedRefType,
          latestObservedCommitSha: params.expectedTargetCommitSha,
        },
      },
      data: {
        status: params.status,
        stage: params.stage,
        progress: params.progress,
      },
    });
  }
}
