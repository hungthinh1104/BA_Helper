export type ApprovedReportMetadata = {
  analysisId: string;
  title: string;
  projectId: string;
  repositoryId: string;
  targetRef: string;
  commitSha: string;
  snapshotId: string;
  analyzerVersion: string;
  generatedDocumentId: string;
  generatedAt: string;
  finalizedAt?: string;
  staleStatusAtReadTime: boolean;
  staleReason?: string;
};
