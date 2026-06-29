export type RetrievalRequest = {
  projectId: string;
  repositoryId: string;
  snapshotId: string;
  changeRequest: string;
  domain?: string;
  expandGraph?: boolean;
  maxResults?: number;
  tenantId?: string;
};

export type RetrievedArtifact = {
  artifactId: string;
  artifactKey: string;
  filePath: string;
  symbolName: string | null;
  artifactType: string;
  score: number;
  retrievalMethod: string;
  retrievalSignals: string[];
  retrievalReason: string;
  strategyVersion?: string;
  lexicalScore?: number;
  graphScore?: number;
  vectorScore?: number;
  domainBoost?: number;
  kindBoost?: number;
  finalScore?: number;
  retrievalDiagnostics?: unknown;
  suggestion?: unknown;
};

export interface RetrievalPort {
  retrieve(request: RetrievalRequest): Promise<RetrievedArtifact[]>;
}
