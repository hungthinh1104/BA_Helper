import { Module } from '@nestjs/common';
import { ArtifactController } from './api/artifact.controller';
import { ListArtifactsUseCase } from './application/list-artifacts.usecase';
import { ProjectModule } from '../project/project.module';
import { PrismaModule, PrismaService, ArtifactRepository } from "@ba-helper/backend-runtime";

@Module({
  imports: [PrismaModule, ProjectModule],
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
