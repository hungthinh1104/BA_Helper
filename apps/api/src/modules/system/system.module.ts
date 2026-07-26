import { Module } from '@nestjs/common';
import { GetSystemHealthUseCase } from './application/get-system-health.usecase';
import { SystemController } from './api/system.controller';
import { EventLogModule, PrismaModule, PrismaService, QueueModule, QueueService } from "@ba-helper/backend-runtime";

@Module({
  imports: [PrismaModule, QueueModule, EventLogModule],
  controllers: [SystemController],
  providers: [
    {
      provide: GetSystemHealthUseCase,
      useFactory: (prisma: PrismaService, queueService: QueueService) =>
        new GetSystemHealthUseCase(prisma, queueService),
      inject: [PrismaService, QueueService],
    },
  ],
})
export class SystemModule {}
