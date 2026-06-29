import { Module } from '@nestjs/common';
import { ScannerModule } from '../../../api/src/modules/scanner/scanner.module';
import { ScanJobProcessor } from './scan-job.processor';

@Module({
  imports: [ScannerModule],
  providers: [
    ScanJobProcessor,
  ],
})
export class ScanJobWorkerModule {}
