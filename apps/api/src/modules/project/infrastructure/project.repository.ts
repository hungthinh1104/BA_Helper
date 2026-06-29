import type { ProjectRole } from '@ba-helper/contracts';
import type { PrismaService } from '../../prisma/prisma.service';

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

  async setSelectedProject(userId: string, projectId: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { selectedProjectId: projectId },
    });
  }

  async findSelectedProjectForUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        selectedProjectId: true,
        selectedProject: true,
      },
    });
  }

  async listProjectsForUser(userId: string) {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      include: { project: true },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.sort((left, right) => {
      const membershipCreatedAt = left.createdAt.getTime() - right.createdAt.getTime();
      if (membershipCreatedAt !== 0) {
        return membershipCreatedAt;
      }
      return left.project.createdAt.getTime() - right.project.createdAt.getTime();
    });
  }

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async listProjectMembers(projectId: string) {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });

    return members.sort((left, right) => left.user.email.localeCompare(right.user.email));
  }

  async countOwners(projectId: string) {
    return this.prisma.projectMember.count({
      where: {
        projectId,
        role: 'OWNER',
      },
    });
  }

  async updateProjectMemberRole(
    projectId: string,
    userId: string,
    role: ProjectRole,
  ) {
    return this.prisma.projectMember.update({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
      data: { role },
    });
  }

  async removeProjectMember(projectId: string, userId: string) {
    return this.prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });
  }

  async clearSelectedProjectForUserIfMatches(userId: string, projectId: string) {
    return this.prisma.user.updateMany({
      where: {
        id: userId,
        selectedProjectId: projectId,
      },
      data: {
        selectedProjectId: null,
      },
    });
  }
}
