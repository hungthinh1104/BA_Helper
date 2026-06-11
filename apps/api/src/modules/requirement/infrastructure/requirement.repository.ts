import { PrismaService } from '../../prisma/prisma.service';

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
    });
  }

  async createRevision(params: {
    requirementId: string;
    title: string;
    rawText: string;
    normalizedText: string;
    readinessStatus: 'DRAFT' | 'READY_FOR_ANALYSIS' | 'NEEDS_CLARIFICATION';
    validationIssues: string[];
  }) {
    return this.prisma.requirementRevision.create({
      data: {
        requirementId: params.requirementId,
        title: params.title,
        rawText: params.rawText,
        normalizedText: params.normalizedText,
        readinessStatus: params.readinessStatus,
        validationIssues: params.validationIssues,
      },
    });
  }

  async updateRevisionStatus(params: {
    revisionId: string;
    readinessStatus: 'READY_FOR_ANALYSIS' | 'NEEDS_CLARIFICATION' | 'ARCHIVED';
    validationIssues: string[];
  }) {
    return this.prisma.requirementRevision.update({
      where: { id: params.revisionId },
      data: {
        readinessStatus: params.readinessStatus,
        validationIssues: params.validationIssues,
      },
    });
  }

  async findRevisionById(id: string) {
    return this.prisma.requirementRevision.findUnique({
      where: { id },
    });
  }
}
