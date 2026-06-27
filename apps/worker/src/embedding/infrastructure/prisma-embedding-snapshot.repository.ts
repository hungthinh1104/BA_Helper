import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../api/src/modules/prisma/prisma.service';
import type { EmbeddingSnapshotRepositoryPort, ArtifactBasic, ArtifactWithEvidenceBasic, SnapshotWithRepositoryBasic } from '@ba-helper/application';
import type { DiagnosticItem, SnapshotIndexStatus } from '@ba-helper/contracts';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaEmbeddingSnapshotRepository implements EmbeddingSnapshotRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findSnapshotById(snapshotId: string): Promise<SnapshotWithRepositoryBasic | null> {
    const snapshot = await this.prisma.repositorySnapshot.findUnique({
      where: { id: snapshotId },
      include: { repository: true },
    });
    if (!snapshot) return null;
    return {
      id: snapshot.id,
      repositoryId: snapshot.repositoryId,
      commitSha: snapshot.commitSha,
      diagnostics: snapshot.diagnostics,
      repository: {
        projectId: snapshot.repository.projectId,
      },
    };
  }

  async updateSnapshotIndexStatus(snapshotId: string, status: SnapshotIndexStatus): Promise<void> {
    await this.prisma.repositorySnapshot.update({
      where: { id: snapshotId },
      data: { indexStatus: status },
    });
  }

  async updateSnapshotDiagnostics(snapshotId: string, status: SnapshotIndexStatus, diagnostics: DiagnosticItem[]): Promise<void> {
    await this.prisma.repositorySnapshot.update({
      where: { id: snapshotId },
      data: {
        indexStatus: status,
        diagnostics: diagnostics as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async findArtifactsWithEvidenceBySnapshot(snapshotId: string): Promise<ArtifactWithEvidenceBasic[]> {
    const artifacts = await this.prisma.codeArtifact.findMany({
      where: { snapshotId },
      include: { evidences: true },
    });
    return artifacts.map((a: any) => ({
      id: a.id,
      snapshotId: a.snapshotId,
      artifactKey: a.artifactKey,
      contentHash: a.contentHash,
      filePath: a.filePath,
      name: a.name,
      artifactType: a.artifactType,
      evidences: a.evidences.map((e: any) => ({
        id: e.id,
        sourcePath: e.sourcePath,
        startLine: e.startLine,
        endLine: e.endLine,
        excerpt: e.excerpt,
      })),
    }));
  }

  async findPreviousArtifactsBySnapshot(snapshotId: string): Promise<ArtifactBasic[]> {
    const previousArtifacts = await this.prisma.codeArtifact.findMany({
      where: { snapshotId },
      select: { id: true, artifactKey: true, contentHash: true },
    });
    return previousArtifacts;
  }

  async markSnapshotFailed(snapshotId: string): Promise<void> {
    await this.prisma.repositorySnapshot.update({
      where: { id: snapshotId },
      data: { indexStatus: 'VECTOR_FAILED' },
    });
  }
}
