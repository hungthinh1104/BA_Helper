export type DocumentJobRunResult = {
  success: true;
  generatedDocumentId: string;
};

export abstract class DocumentJobRunnerPort {
  abstract run(params: {
    documentJobId: string;
  }): Promise<DocumentJobRunResult>;
}
