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
  staleStatusAtReadTime: boolean;
  staleReason?: string;
  requirementRevisionId?: string;
  runId?: string;
  childAnalysisCount?: number;
};
