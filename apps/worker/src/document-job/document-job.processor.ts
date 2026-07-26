import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RunDocumentJobUseCase } from '@ba-helper/application/document';
import { processWithClassification } from '../shared/classified-processing';

@Processor('document-job')
export class DocumentJobWorker extends WorkerHost {
  private readonly logger = new Logger(DocumentJobWorker.name);

  constructor(private readonly runDocumentJob: RunDocumentJobUseCase) {
    super();
  }

  async process(job: Job<{ documentJobId: string }, unknown, string>): Promise<void> {
    if (!job.data?.documentJobId) {
      throw new Error('Document job payload missing documentJobId.');
    }
    await processWithClassification({
      logger: this.logger,
      job,
      event: 'DOCUMENT_JOB',
      context: { documentJobId: job.data.documentJobId },
      run: () =>
        this.runDocumentJob.execute({ documentJobId: job.data.documentJobId }),
    });
  }
}
