import { Module } from '@nestjs/common';
import { EventLogModule as RuntimeEventLogModule } from "@ba-helper/backend-runtime";

@Module({
  imports: [RuntimeEventLogModule],
  exports: [RuntimeEventLogModule],
})
export class EventLogModule {}
