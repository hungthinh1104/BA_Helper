export type DocumentExportedEventPayload = {
  eventType: 'DOCUMENT_EXPORTED';
  impactAnalysisId: string;
  generatedDocumentId: string;
  projectId: string;
  repositoryId: string;
  snapshotId: string;
  commitSha: string;
  format: 'markdown' | 'pdf';
  exportedAt: string; // ISO format date string
  filename: string;
  actorId: string;
  actorType: string;
};
