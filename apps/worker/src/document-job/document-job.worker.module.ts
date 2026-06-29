import { Module } from '@nestjs/common';
// v0.1 constraint: DocumentApplicationModule lives in apps/api until extracted to a shared package.
// It has no HTTP controllers — only application use cases and repositories.
import { DocumentRuntimeModule } from '@ba-helper/backend-runtime';
import { DocumentJobWorker } from './document-job.processor';

@Module({
  imports: [DocumentRuntimeModule],
  providers: [DocumentJobWorker],
})
export class DocumentJobWorkerModule {}
