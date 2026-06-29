import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
// v0.1 constraint: RunDocumentJobUseCase lives in apps/api until extracted to a shared package.
import { RunDocumentJobUseCase } from '@ba-helper/backend-runtime';

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
