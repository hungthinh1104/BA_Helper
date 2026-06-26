/** Minimal analysis record for RunImpactAnalysisUseCase */
export type ImpactAnalysisRecord = {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'WAITING_FOR_REVIEW' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  stage: 'WAITING' | 'RETRIEVING_EVIDENCE' | 'EXPANDING_GRAPH' | 'RUNNING_AI_REASONING' | 'GENERATING_INSIGHTS' | 'GENERATING_DOCUMENTS' | 'DONE';
  progress: number;
  snapshot: {
    id: string;
    repositoryId: string;
    analyzerVersion: string;
    diagnostics?: unknown;
    repository: {
      projectId: string;
    };
    profile?: { domain?: string | null } | null;
  };
  requirementRevision: {
    rawText: string;
    requirement?: { projectId?: string } | null;
  };
  multiRepoRun?: { createdByUserId?: string | null } | null;
};

export type ImpactAnalysisStatusUpdate = {
  id: string;
  status: 'COMPLETED' | 'WAITING_FOR_REVIEW' | 'FAILED' | 'CANCELLED' | 'RUNNING' | 'QUEUED';
  stage: 'WAITING' | 'RETRIEVING_EVIDENCE' | 'EXPANDING_GRAPH' | 'RUNNING_AI_REASONING' | 'GENERATING_INSIGHTS' | 'GENERATING_DOCUMENTS' | 'DONE';
  progress: number;
  metadata?: {
    llm?: {
      provider: string;
      model: string;
      promptVersion: string;
      parseMode?: 'raw' | 'extracted';
      inputTokens?: number | null;
      outputTokens?: number | null;
      estimatedCostUsd?: number | null;
      evidenceItems?: number;
      evidenceChars?: number;
      evidenceTruncated?: boolean;
      domainContextUsed?: string;
    };
    retrieval?: {
      strategy: string;
      maxArtifacts: number;
      artifactCount: number;
      vectorSignalCount?: number;
    };
    domainPack?: {
      id: string;
      version: string;
      status: string;
      selectedBy: string;
    };
    diagnostics?: Array<{
      code: string;
      severity: string;
      message: string;
      payload?: unknown;
    }>;
  };
  error?: {
    code: string;
    message: string;
    stage: string;
    retryable: boolean;
    details?: unknown;
  };
};

export interface ImpactAnalysisRepositoryPort {
  findById(id: string): Promise<ImpactAnalysisRecord | null>;
  updateStatus(params: ImpactAnalysisStatusUpdate): Promise<unknown>;
}
