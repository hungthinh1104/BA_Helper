import { Module } from '@nestjs/common';
import { PrismaModule } from '@ba-helper/backend-runtime/prisma';
import { StaleJobRecoveryService } from './stale-job-recovery.service';

@Module({
  imports: [PrismaModule],
  providers: [StaleJobRecoveryService],
  exports: [StaleJobRecoveryService],
})
export class StaleJobRecoveryModule {}
