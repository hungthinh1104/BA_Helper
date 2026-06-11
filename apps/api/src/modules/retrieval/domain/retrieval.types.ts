export interface RetrievedArtifact {
  artifactId: string;
  artifactKey: string;
  filePath: string;
  symbolName: string | null;
  artifactType: string;
  score: number;
  retrievalMethod: 'LEXICAL' | 'VECTOR' | 'GRAPH' | 'HYBRID';
}

export interface RetrievalRequest {
  /** MVP: tenantId = projectId. Future: organizationId. Used to isolate vector search. */
  tenantId?: string;
  projectId: string;
  repositoryId: string;
  snapshotId: string;
  changeRequest: string;
  /** Domain profile key e.g. 'BOOKING'. Drives glossary-based keyword expansion. */
  domain?: string;
  expandGraph?: boolean;
  maxResults?: number;
}
