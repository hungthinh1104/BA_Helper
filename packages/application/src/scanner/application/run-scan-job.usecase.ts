import type { ScanJobRunnerPort } from '../ports/scan-job-runner.port';

export class RunScanJobUseCase {
  constructor(private readonly runner: ScanJobRunnerPort) {}

  async execute(params: { jobId: string }): Promise<void> {
    await this.runner.run(params);
  }
}
