import type {
  DocumentJobRunnerPort,
  DocumentJobRunResult,
} from '../ports/document-job-runner.port';

export class RunDocumentJobUseCase {
  constructor(private readonly runner: DocumentJobRunnerPort) {}

  async execute(params: {
    documentJobId: string;
    attemptNumber?: number;
    maxAttempts?: number;
  }): Promise<DocumentJobRunResult> {
    return this.runner.run(params);
  }
}
