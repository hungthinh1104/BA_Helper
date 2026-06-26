import { Module } from '@nestjs/common';
import { DocumentApplicationModule } from '../../../api/src/modules/document/document-application.module';
import { DocumentJobWorker } from './document-job.processor';

@Module({
  imports: [DocumentApplicationModule],
  providers: [DocumentJobWorker],
})
export class DocumentJobWorkerModule {}
