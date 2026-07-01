import { Injectable } from '@nestjs/common';
import { PrismaService } from "@ba-helper/backend-runtime";

@Injectable()
export class ProjectScopeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAnalysisProjectId(analysisId: string): Promise<string | null> {
    const analysis = await this.prisma.impactAnalysis.findUnique({
      where: { id: analysisId },
      select: {
        requirementRevision: {
          select: {
            requirement: {
              select: {
                projectId: true,
              },
            },
          },
        },
      },
    });

    return analysis?.requirementRevision.requirement.projectId ?? null;
  }

  async findRequirementProjectId(requirementId: string): Promise<string | null> {
    const requirement = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
      select: { projectId: true },
    });

    return requirement?.projectId ?? null;
  }

  async findRequirementRevisionProjectId(revisionId: string): Promise<string | null> {
    const revision = await this.prisma.requirementRevision.findUnique({
      where: { id: revisionId },
      select: {
        requirement: {
          select: {
            projectId: true,
          },
        },
      },
    });

    return revision?.requirement.projectId ?? null;
  }

  async findRepositoryProjectId(repositoryId: string): Promise<string | null> {
    const repository = await this.prisma.repository.findUnique({
      where: { id: repositoryId },
      select: { projectId: true },
    });

    return repository?.projectId ?? null;
  }

  async findSnapshotProjectId(snapshotId: string): Promise<string | null> {
    const snapshot = await this.prisma.repositorySnapshot.findUnique({
      where: { id: snapshotId },
      select: {
        repository: {
          select: {
            projectId: true,
          },
        },
      },
    });

    return snapshot?.repository.projectId ?? null;
  }

  async findScanJobProjectId(scanJobId: string): Promise<string | null> {
    const job = await this.prisma.scanJob.findUnique({
      where: { id: scanJobId },
      select: {
        repository: {
          select: {
            projectId: true,
          },
        },
      },
    });

    return job?.repository.projectId ?? null;
  }

  async findClarificationProjectId(clarificationId: string): Promise<string | null> {
    const clarification = await this.prisma.clarificationItem.findUnique({
      where: { id: clarificationId },
      select: {
        impactAnalysis: {
          select: {
            requirementRevision: {
              select: {
                requirement: {
                  select: {
                    projectId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return clarification?.impactAnalysis.requirementRevision.requirement.projectId ?? null;
  }

  async findReviewClarificationProjectId(clarificationId: string): Promise<string | null> {
    const clarification = await this.prisma.reviewClarificationRequest.findUnique({
      where: { id: clarificationId },
      select: {
        analysis: {
          select: {
            requirementRevision: {
              select: {
                requirement: {
                  select: {
                    projectId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return clarification?.analysis.requirementRevision.requirement.projectId ?? null;
  }

  async findInsightProjectId(insightId: string): Promise<string | null> {
    const insight = await this.prisma.baInsight.findUnique({
      where: { id: insightId },
      select: {
        impactAnalysis: {
          select: {
            requirementRevision: {
              select: {
                requirement: {
                  select: {
                    projectId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return insight?.impactAnalysis.requirementRevision.requirement.projectId ?? null;
  }

  async findTraceabilityLinkProjectId(linkId: string): Promise<string | null> {
    const link = await this.prisma.traceabilityLink.findUnique({
      where: { id: linkId },
      select: {
        impactAnalysis: {
          select: {
            requirementRevision: {
              select: {
                requirement: {
                  select: {
                    projectId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return link?.impactAnalysis.requirementRevision.requirement.projectId ?? null;
  }

  async findMultiRepoRunProjectId(runId: string): Promise<string | null> {
    const run = await this.prisma.multiRepoAnalysisRun.findUnique({
      where: { id: runId },
      select: { projectId: true },
    });

    return run?.projectId ?? null;
  }
}
