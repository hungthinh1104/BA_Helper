import { Module } from '@nestjs/common';
import { EvidenceController } from './api/evidence.controller';
import { ListEvidenceUseCase } from './application/list-evidence.usecase';
import { EvidenceRepository } from './infrastructure/evidence.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [PrismaModule, ProjectModule],
  controllers: [EvidenceController],
  providers: [
    {
      provide: EvidenceRepository,
      useFactory: (prisma: PrismaService) => new EvidenceRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ListEvidenceUseCase,
      useFactory: (repo: EvidenceRepository, prisma: PrismaService) =>
        new ListEvidenceUseCase(repo, prisma),
      inject: [EvidenceRepository, PrismaService],
    },
  ],
  exports: [EvidenceRepository],
})
export class EvidenceModule {}
