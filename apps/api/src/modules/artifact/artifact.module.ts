import { Module } from '@nestjs/common';
import { ArtifactController } from './api/artifact.controller';
import { ListArtifactsUseCase } from './application/list-artifacts.usecase';
import { ProjectModule } from '../project/project.module';
import { PrismaModule, PrismaService, ArtifactRepository } from "@ba-helper/backend-runtime";
import { EvidenceModule } from '../evidence/evidence.module';
import { GraphModule } from '../graph/graph.module';
import { GetCodeComprehensionUseCase } from './application/get-code-comprehension.usecase';

@Module({
  imports: [PrismaModule, ProjectModule, EvidenceModule, GraphModule],
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
    GetCodeComprehensionUseCase,
  ],
  exports: [ArtifactRepository],
})
export class ArtifactModule {}
