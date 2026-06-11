export type DocumentExportedEventPayload = {
  eventType: 'DOCUMENT_EXPORTED';
  impactAnalysisId: string;
  documentId: string;
  repositoryId: string;
  snapshotId: string;
  commitSha: string;
  format: 'markdown';
  exportedAt: string; // ISO format date string
  filename: string;
  isStale?: boolean;
  actorId?: string;
};
