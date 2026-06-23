import { Module } from '@nestjs/common';
import { DocumentModule } from '../../../api/src/modules/document/document.module';
import { DocumentJobWorker } from '../../../api/src/modules/impact-analysis/worker/document-job.worker';

@Module({
  imports: [DocumentModule],
  providers: [DocumentJobWorker],
})
export class DocumentJobWorkerModule {}
