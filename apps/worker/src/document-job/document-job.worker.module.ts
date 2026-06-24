import { Module } from '@nestjs/common';
import { DocumentApplicationModule } from '../../../api/src/modules/document/document-application.module';
import { DocumentJobWorker } from '../../../api/src/modules/impact-analysis/worker/document-job.worker';

@Module({
  imports: [DocumentApplicationModule],
  providers: [DocumentJobWorker],
})
export class DocumentJobWorkerModule {}
