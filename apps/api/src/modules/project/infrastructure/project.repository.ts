import { PrismaService } from '../../prisma/prisma.service';

export class ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createProject(name: string) {
    return this.prisma.project.create({
      data: { name },
    });
  }

  async findById(id: string) {
    return this.prisma.project.findUnique({
      where: { id },
    });
  }
}
