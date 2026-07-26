export type EvidenceUpsertInput = {
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
};

export type EvidenceRecord = {
  id: string;
  artifactId: string | null;
  excerpt: string;
};

export interface EvidenceRepositoryPort {
  listByArtifactIds(params: {
    snapshotId: string;
    artifactIds: string[];
  }): Promise<EvidenceRecord[]>;
}
