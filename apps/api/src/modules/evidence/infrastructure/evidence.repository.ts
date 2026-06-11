import { PrismaService } from '../../prisma/prisma.service';

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
  ) {
    if (items.length === 0) {
      return [];
    }

    await this.prisma.evidence.createMany({
      data: items.map((item) => ({
        provenanceKey: item.provenanceKey,
        sourceType: item.sourceType as any,
        snapshotId: item.snapshotId ?? null,
        artifactId: item.artifactId ?? null,
        requirementRevisionId: item.requirementRevisionId ?? null,
        sourcePath: item.sourcePath ?? null,
        startLine: item.startLine ?? null,
        endLine: item.endLine ?? null,
        excerpt: item.excerpt,
        contentHash: item.contentHash,
        isRedacted: item.isRedacted,
        redactionMetadata: (item.redactionMetadata ?? null) as any,
      })),
      skipDuplicates: true,
    });

    return this.prisma.evidence.findMany({
      where: {
        provenanceKey: { in: items.map((item) => item.provenanceKey) },
      },
    });
  }
}
