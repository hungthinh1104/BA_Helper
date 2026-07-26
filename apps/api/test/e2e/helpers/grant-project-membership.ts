import type { ProjectRole } from '@prisma/client';
import { PrismaService } from "@ba-helper/backend-runtime";

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
