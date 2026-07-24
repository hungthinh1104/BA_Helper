export abstract class ScanJobRunnerPort {
  abstract run(params: { jobId: string }): Promise<void>;
}
