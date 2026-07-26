import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RunScanJobUseCase } from '@ba-helper/application/scanner';
import { processWithClassification } from '../shared/classified-processing';

@Processor('scan-job')
export class ScanJobProcessor extends WorkerHost {
  private readonly logger = new Logger(ScanJobProcessor.name);

  constructor(private readonly runScanJob: RunScanJobUseCase) {
    super();
  }

  async process(job: Job<{ jobId: string }>): Promise<void> {
    await processWithClassification({
      logger: this.logger,
      job,
      event: 'SCAN_JOB',
      context: { scanJobId: job.data.jobId },
      run: () => this.runScanJob.execute({ jobId: job.data.jobId }),
    });
  }
}
