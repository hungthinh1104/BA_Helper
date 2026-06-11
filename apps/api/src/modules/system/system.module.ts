import { Module } from '@nestjs/common';
import { GetSystemHealthUseCase } from './application/get-system-health.usecase';
import { SystemController } from './api/system.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { QueueModule } from '../queue/queue.module';
import { QueueService } from '../queue/queue.service';

@Module({
  imports: [PrismaModule, QueueModule],
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
