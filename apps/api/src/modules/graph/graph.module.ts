import { Module } from '@nestjs/common';
import { GraphController } from './api/graph.controller';
import { GetGraphUseCase } from './application/get-graph.usecase';
import { ProjectModule } from '../project/project.module';
import { PrismaModule, PrismaService, GraphRepository } from "@ba-helper/backend-runtime";

@Module({
  imports: [PrismaModule, ProjectModule],
  controllers: [GraphController],
  providers: [
    {
      provide: GraphRepository,
      useFactory: (prisma: PrismaService) => new GraphRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: GetGraphUseCase,
      useFactory: (repo: GraphRepository, prisma: PrismaService) =>
        new GetGraphUseCase(repo, prisma),
      inject: [GraphRepository, PrismaService],
    },
  ],
  exports: [GraphRepository],
})
export class GraphModule {}
