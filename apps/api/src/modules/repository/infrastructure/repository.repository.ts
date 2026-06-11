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
    });
  }
}
