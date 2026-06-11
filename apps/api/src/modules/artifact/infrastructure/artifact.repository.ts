import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ArtifactRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listBySnapshot(snapshotId: string) {
    return this.prisma.codeArtifact.findMany({
      where: { snapshotId },
    });
  }

  async findById(id: string) {
    return this.prisma.codeArtifact.findUnique({
      where: { id },
    });
  }

  async createMany(data: Array<{
    snapshotId: string;
    artifactKey: string;
    artifactType: string;
    name: string;
    filePath: string;
    startLine?: number;
    endLine?: number;
  }>) {
    return this.prisma.codeArtifact.createMany({
      data,
      skipDuplicates: true,
    });
  }
}
