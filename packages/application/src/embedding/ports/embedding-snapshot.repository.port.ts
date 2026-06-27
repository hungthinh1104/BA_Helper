import type { DiagnosticItem, SnapshotIndexStatus } from '@ba-helper/contracts';

export interface SnapshotWithRepositoryBasic {
  id: string;
  repositoryId: string;
  commitSha: string;
  diagnostics: unknown;
  repository: {
    projectId: string;
  };
}

export interface ArtifactBasic {
  id: string;
  artifactKey: string;
  contentHash: string | null;
}

export interface ArtifactWithEvidenceBasic {
  id: string;
  snapshotId: string;
  artifactKey: string;
  contentHash: string | null;
  filePath: string;
  name: string | null;
  artifactType: string;
  evidences: Array<{
    id: string;
    sourcePath: string | null;
    startLine: number | null;
    endLine: number | null;
    excerpt: string;
  }>;
}

export interface EmbeddingSnapshotRepositoryPort {
  findSnapshotById(snapshotId: string): Promise<SnapshotWithRepositoryBasic | null>;
  updateSnapshotIndexStatus(snapshotId: string, status: SnapshotIndexStatus): Promise<void>;
  updateSnapshotDiagnostics(snapshotId: string, status: SnapshotIndexStatus, diagnostics: DiagnosticItem[]): Promise<void>;
  findArtifactsWithEvidenceBySnapshot(snapshotId: string): Promise<ArtifactWithEvidenceBasic[]>;
  findPreviousArtifactsBySnapshot(snapshotId: string): Promise<ArtifactBasic[]>;
  markSnapshotFailed(snapshotId: string): Promise<void>;
}
