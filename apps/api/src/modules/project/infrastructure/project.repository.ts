import type { ProjectRole } from '@ba-helper/contracts';
import { PrismaService } from '../../prisma/prisma.service';

export class ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createProject(name: string) {
    return this.prisma.project.create({
      data: { name },
    });
  }

  async ensureProjectMember(
    projectId: string,
    userId: string,
    role: ProjectRole,
  ) {
    return this.prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
      update: { role },
      create: {
        projectId,
        userId,
        role,
      },
    });
  }

  async findProjectMember(projectId: string, userId: string) {
    return this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });
  }

  async findById(id: string) {
    return this.prisma.project.findUnique({
      where: { id },
    });
  }

  async findByName(name: string) {
    return this.prisma.project.findFirst({
      where: { name },
      orderBy: { createdAt: 'asc' },
    });
  }
}
