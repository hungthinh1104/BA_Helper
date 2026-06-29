import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../index';;

type ArtifactPrismaClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class ArtifactRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listBySnapshot(snapshotId: string, client: ArtifactPrismaClient = this.prisma) {
    return client.codeArtifact.findMany({
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
    universalKind: string;
    name: string;
    filePath: string;
    startLine?: number;
    endLine?: number;
    contentHash?: string | null;
  }>, client: ArtifactPrismaClient = this.prisma) {
    return client.codeArtifact.createMany({
      data,
      skipDuplicates: true,
    });
  }
}
