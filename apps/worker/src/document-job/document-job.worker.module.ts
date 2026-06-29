import { Module } from '@nestjs/common';
// v0.1 constraint: DocumentApplicationModule lives in apps/api until extracted to a shared package.
// It has no HTTP controllers — only application use cases and repositories.
import { DocumentApplicationModule } from '@ba-helper/api/modules/document/document-application.module';
import { DocumentJobWorker } from './document-job.processor';

@Module({
  imports: [DocumentApplicationModule],
  providers: [DocumentJobWorker],
})
export class DocumentJobWorkerModule {}
