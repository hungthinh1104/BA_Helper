import { Module } from '@nestjs/common';
import { GraphController } from './api/graph.controller';
import { GetGraphUseCase } from './application/get-graph.usecase';
import { GraphRepository } from './infrastructure/graph.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [PrismaModule],
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
})
export class GraphModule {}
