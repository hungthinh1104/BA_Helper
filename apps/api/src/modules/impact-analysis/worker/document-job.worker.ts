import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RunDocumentJobUseCase } from '../../document/application/run-document-job.usecase';

@Processor('document-job')
export class DocumentJobWorker extends WorkerHost {
  constructor(private readonly runDocumentJob: RunDocumentJobUseCase) {
    super();
  }

  async process(job: Job<{ documentJobId: string }, any, string>): Promise<any> {
    if (!job.data?.documentJobId) {
      throw new Error('Document job payload missing documentJobId.');
    }
    return this.runDocumentJob.execute({ documentJobId: job.data.documentJobId });
  }
}
