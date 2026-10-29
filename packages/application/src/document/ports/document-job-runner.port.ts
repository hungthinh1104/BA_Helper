export type DocumentJobRunResult = {
  success: true;
  generatedDocumentId: string;
};

export abstract class DocumentJobRunnerPort {
  abstract run(params: {
    documentJobId: string;
    attemptNumber?: number;
    maxAttempts?: number;
  }): Promise<DocumentJobRunResult>;
}
