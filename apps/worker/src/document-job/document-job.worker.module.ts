import { Module } from '@nestjs/common';
import { DocumentRuntimeModule } from '@ba-helper/backend-runtime/document';
import { DocumentJobWorker } from './document-job.processor';

@Module({
  imports: [DocumentRuntimeModule],
  providers: [DocumentJobWorker],
})
export class DocumentJobWorkerModule {}
