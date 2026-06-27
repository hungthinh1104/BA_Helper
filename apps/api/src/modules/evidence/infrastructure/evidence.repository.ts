import { Injectable } from '@nestjs/common';
import type { EvidenceSourceType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type EvidencePrismaClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class EvidenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByAnalysis(params: { snapshotId: string; revisionId: string }) {
    return this.prisma.evidence.findMany({
      where: {
        OR: [
          { snapshotId: params.snapshotId },
          { requirementRevisionId: params.revisionId },
        ],
      },
    });
  }

  async upsertMany(
    items: Array<{
      provenanceKey: string;
      sourceType: string;
      snapshotId: string | null;
      artifactId: string | null;
      requirementRevisionId?: string | null;
      sourcePath: string | null;
      startLine: number | null;
      endLine: number | null;
      excerpt: string;
      contentHash: string;
      isRedacted: boolean;
      redactionMetadata: Record<string, unknown> | null;
    }>,
    client: EvidencePrismaClient = this.prisma,
  ) {
    if (items.length === 0) {
      return [];
    }

    await client.evidence.createMany({
      data: items.map((item) => ({
        provenanceKey: item.provenanceKey,
        sourceType: item.sourceType as EvidenceSourceType,
        snapshotId: item.snapshotId ?? null,
        artifactId: item.artifactId ?? null,
        requirementRevisionId: item.requirementRevisionId ?? null,
        sourcePath: item.sourcePath ?? null,
        startLine: item.startLine ?? null,
        endLine: item.endLine ?? null,
        excerpt: item.excerpt,
        contentHash: item.contentHash,
        isRedacted: item.isRedacted,
        redactionMetadata: (item.redactionMetadata ?? null) as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    });

    return client.evidence.findMany({
      where: {
        provenanceKey: { in: items.map((item) => item.provenanceKey) },
      },
    });
  }
}
