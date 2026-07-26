import { Module } from '@nestjs/common';
import { ScannerRuntimeModule } from '@ba-helper/backend-runtime/scanner';
import { ScanJobProcessor } from './scan-job.processor';

@Module({
  imports: [ScannerRuntimeModule],
  providers: [ScanJobProcessor],
})
export class ScanJobWorkerModule {}
