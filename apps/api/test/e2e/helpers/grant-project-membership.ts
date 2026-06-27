import type { ProjectRole } from '@prisma/client';
import type { PrismaService } from '../../../src/modules/prisma/prisma.service';

export async function grantProjectMembership(
  prisma: PrismaService,
  params: {
    projectId: string;
    userId: string;
    role: ProjectRole;
  },
) {
  return prisma.projectMember.upsert({
    where: {
      projectId_userId: {
        projectId: params.projectId,
        userId: params.userId,
      },
    },
    update: {
      role: params.role,
    },
    create: {
      projectId: params.projectId,
      userId: params.userId,
      role: params.role,
    },
  });
}
