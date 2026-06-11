import { Module } from '@nestjs/common';
import { ProjectController } from './api/project.controller';
import { CreateProjectUseCase } from './application/create-project.usecase';
import { ProjectRepository } from './infrastructure/project.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { EventLogModule } from '../event-log/event-log.module';
import { EventLogService } from '../event-log/application/event-log.service';

@Module({
  imports: [PrismaModule, EventLogModule],
  controllers: [ProjectController],
  providers: [
    {
      provide: ProjectRepository,
      useFactory: (prisma: PrismaService) => new ProjectRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: CreateProjectUseCase,
      useFactory: (repo: ProjectRepository, eventLog: EventLogService) =>
        new CreateProjectUseCase(repo, eventLog),
      inject: [ProjectRepository, EventLogService],
    },
  ],
})
export class ProjectModule {}
