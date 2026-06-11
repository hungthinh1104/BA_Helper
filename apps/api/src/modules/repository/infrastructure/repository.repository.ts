import { PrismaService } from '../../prisma/prisma.service';

export class RepositoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProjectAndUrl(params: { projectId: string; canonicalUrl: string }) {
    return this.prisma.repository.findUnique({
      where: {
        projectId_canonicalUrl: {
          projectId: params.projectId,
          canonicalUrl: params.canonicalUrl,
        },
      },
    });
  }

  async createRepository(params: { projectId: string; canonicalUrl: string }) {
    return this.prisma.repository.create({
      data: {
        projectId: params.projectId,
        canonicalUrl: params.canonicalUrl,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.repository.findUnique({
      where: { id },
      include: {
        targets: {
          orderBy: { lastObservedAt: 'desc' },
          take: 1,
        },
        snapshots: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            artifacts: true,
          }
        },
        scanJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        }
      },
    });
  }

  async findByProject(projectId: string, limit?: number, offset?: number) {
    return this.prisma.repository.findMany({
      where: { projectId },
      take: limit,
      skip: offset,
      include: {
        targets: {
          orderBy: { lastObservedAt: 'desc' },
          take: 1,
        },
        snapshots: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        scanJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
