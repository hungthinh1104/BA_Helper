import type {
  DocumentJobRunnerPort,
  DocumentJobRunResult,
} from '../ports/document-job-runner.port';

export class RunDocumentJobUseCase {
  constructor(private readonly runner: DocumentJobRunnerPort) {}

  async execute(params: {
    documentJobId: string;
  }): Promise<DocumentJobRunResult> {
    return this.runner.run(params);
  }
}
