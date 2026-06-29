export type PersistedArtifact = {
  id: string;
  artifactKey: string;
  artifactType: string;
  name: string;
  filePath: string;
  startLine: number | null;
  endLine: number | null;
};

export interface ArtifactRepositoryPort {
  listBySnapshot(snapshotId: string): Promise<PersistedArtifact[]>;
}
