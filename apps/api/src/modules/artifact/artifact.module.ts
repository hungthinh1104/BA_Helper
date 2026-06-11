import { Module } from '@nestjs/common';
import { ArtifactController } from './api/artifact.controller';
import { ListArtifactsUseCase } from './application/list-artifacts.usecase';
import { ArtifactRepository } from './infrastructure/artifact.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [PrismaModule],
  controllers: [ArtifactController],
  providers: [
    {
      provide: ArtifactRepository,
      useFactory: (prisma: PrismaService) => new ArtifactRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ListArtifactsUseCase,
      useFactory: (repo: ArtifactRepository, prisma: PrismaService) =>
        new ListArtifactsUseCase(repo, prisma),
      inject: [ArtifactRepository, PrismaService],
    },
  ],
  exports: [ArtifactRepository],
})
export class ArtifactModule {}
