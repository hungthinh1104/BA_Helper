import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ImpactAnalysisRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.impactAnalysis.findUnique({
      where: { id },
      include: {
        snapshot: {
          include: {
            repository: true,
          },
        },
        sourceTarget: true,
        requirementRevision: true,
        insights: true,
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
    requestKey: string;
    acceptedPartialCoverage: boolean;
    coverageWarning?: string | null;
  }) {
    return this.prisma.impactAnalysis.create({
      data: {
        requirementRevisionId: params.requirementRevisionId,
        snapshotId: params.snapshotId,
        sourceTargetId: params.sourceTargetId,
        requestKey: params.requestKey,
        status: 'QUEUED',
        stage: 'WAITING',
        progress: 0,
        acceptedPartialCoverage: params.acceptedPartialCoverage,
        coverageWarning: params.coverageWarning ?? null,
      },
      include: {
        snapshot: true,
        sourceTarget: true,
        requirementRevision: true,
        insights: true,
      },
    });
  }

  async updateStatus(params: {
    id: string;
    status: 'COMPLETED' | 'WAITING_FOR_REVIEW' | 'FAILED' | 'CANCELLED' | 'RUNNING' | 'QUEUED';
    stage: 'WAITING' | 'RETRIEVING_EVIDENCE' | 'EXPANDING_GRAPH' | 'RUNNING_AI_REASONING' | 'GENERATING_INSIGHTS' | 'GENERATING_DOCUMENTS' | 'DONE';
    progress: number;
    metadata?: import('../domain/impact-analysis.types').ImpactAnalysisMetadata;
  }) {
    return this.prisma.impactAnalysis.update({
      where: { id: params.id },
      data: {
        status: params.status,
        stage: params.stage,
        progress: params.progress,
        ...(params.metadata ? { metadata: params.metadata as any } : {}),
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
