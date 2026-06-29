import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
// v0.1 constraint: RunScanJobUseCase lives in apps/api until extracted to a shared package.
import { RunScanJobUseCase } from '@ba-helper/api/modules/scanner/application/run-scan-job.usecase';

@Processor('scan-job')
export class ScanJobProcessor extends WorkerHost {
  constructor(private readonly runScanJob: RunScanJobUseCase) {
    super();
  }

  async process(job: Job<{ jobId: string }>): Promise<void> {
    await this.runScanJob.execute({
      jobId: job.data.jobId,
    });
  }
}
