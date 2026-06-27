export type ApprovedReportMetadata = {
  reportScope?: 'SINGLE_ANALYSIS' | 'MULTI_REPO_RUN';
  analysisId: string;
  title: string;
  projectId: string;
  repositoryId?: string;
  targetRef?: string;
  commitSha?: string;
  snapshotId?: string;
  analyzerVersion?: string;
  generatedDocumentId: string;
  generatedAt: string;
  finalizedAt?: string;
  approvedDocumentCreatedAt?: string;
  approvedDocumentUpdatedAt?: string;
  staleStatusAtReadTime: boolean;
  staleReason?: string;
  domainPack?: {
    domainPackId: string;
    domainPackVersion: string;
    domainPackStatus: 'STABLE' | 'PARTIAL' | 'EXPERIMENTAL' | 'FALLBACK';
    selectedBy: 'EXPLICIT' | 'REPOSITORY_PROFILE' | 'FALLBACK';
  };
  requirementRevisionId?: string;
  runId?: string;
  childAnalysisCount?: number;
};
