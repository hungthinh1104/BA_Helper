import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ScanJobStatus, ScanJobStage } from '@prisma/client';

@Injectable()
export class ScanJobRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.scanJob.findUnique({
      where: { id },
      include: {
        repository: true,
        snapshot: {
          include: { repository: true },
        },
      },
    });
  }

  async findByRepositoryAndRequestKey(params: {
    repositoryId: string;
    requestKey: string;
  }) {
    return this.prisma.scanJob.findUnique({
      where: {
        repositoryId_requestKey: {
          repositoryId: params.repositoryId,
          requestKey: params.requestKey,
        },
      },
    });
  }

  async createQueued(params: {
    repositoryId: string;
    requestKey: string;
    requestedRef?: string;
  }) {
    return this.prisma.scanJob.create({
      data: {
        repositoryId: params.repositoryId,
        requestKey: params.requestKey,
        requestedRef: params.requestedRef,
        status: ScanJobStatus.QUEUED,
        stage: ScanJobStage.WAITING,
        progress: 0,
      },
    });
  }

  async updateState(params: {
    jobId: string;
    status: ScanJobStatus;
    stage: ScanJobStage;
    progress: number;
    errorCode?: string | null;
    errorMessage?: string;
  }) {
    return this.prisma.scanJob.update({
      where: { id: params.jobId },
      data: {
        status: params.status,
        stage: params.stage,
        progress: params.progress,
        errorCode: params.errorCode ?? null,
        errorMessage: params.errorMessage ?? null,
      },
    });
  }
}
