import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RunScanJobUseCase } from '../../../api/src/modules/scanner/application/run-scan-job.usecase';

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
