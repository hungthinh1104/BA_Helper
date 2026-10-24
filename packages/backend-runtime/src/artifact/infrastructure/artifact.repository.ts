import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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

  async findBySnapshotAndId(snapshotId: string, id: string) {
    return this.prisma.codeArtifact.findFirst({
      where: { snapshotId, id },
    });
  }

  async listBySnapshotAndIds(snapshotId: string, ids: string[]) {
    if (ids.length === 0) return [];
    return this.prisma.codeArtifact.findMany({
      where: { snapshotId, id: { in: [...new Set(ids)] } },
      orderBy: [{ filePath: 'asc' }, { startLine: 'asc' }, { id: 'asc' }],
    });
  }

  async listBySnapshotAndArtifactKeys(snapshotId: string, artifactKeys: string[]) {
    if (artifactKeys.length === 0) return [];
    return this.prisma.codeArtifact.findMany({
      where: { snapshotId, artifactKey: { in: [...new Set(artifactKeys)] } },
      orderBy: [{ artifactKey: 'asc' }, { id: 'asc' }],
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
    metadata?: Prisma.InputJsonValue;
  }>, client: ArtifactPrismaClient = this.prisma) {
    return client.codeArtifact.createMany({
      data,
      skipDuplicates: true,
    });
  }
}
