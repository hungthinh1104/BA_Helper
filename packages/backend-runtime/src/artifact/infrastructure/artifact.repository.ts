import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { MAX_ARTIFACT_SEARCH_OFFSET } from '@ba-helper/contracts';
import { PrismaService } from '../../prisma/prisma.service';

type ArtifactPrismaClient = PrismaService | Prisma.TransactionClient;

export type ArtifactSearchOptions = {
  limit: number;
  offset: number;
  search?: string;
  artifactTypes?: string[];
};

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

  async searchBySnapshot(snapshotId: string, options: ArtifactSearchOptions) {
    const limit = Math.min(100, Math.max(1, Math.trunc(options.limit)));
    const offset = Math.min(MAX_ARTIFACT_SEARCH_OFFSET, Math.max(0, Math.trunc(options.offset)));
    const search = options.search?.trim();
    const rows = await this.prisma.codeArtifact.findMany({
      where: {
        snapshotId,
        ...(options.artifactTypes?.length ? { artifactType: { in: options.artifactTypes } } : {}),
        ...(search ? { OR: [
          { artifactKey: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { filePath: { contains: search, mode: 'insensitive' } },
        ] } : {}),
      },
      orderBy: [{ artifactType: 'asc' }, { artifactKey: 'asc' }, { id: 'asc' }],
      skip: offset,
      take: limit + 1,
    });
    const moreRowsExist = rows.length > limit;
    const limitReached = moreRowsExist && offset + limit > MAX_ARTIFACT_SEARCH_OFFSET;
    return { items: rows.slice(0, limit), hasMore: moreRowsExist && !limitReached,
      ...(limitReached ? { limitReached: true } : {}), limit, offset };
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
