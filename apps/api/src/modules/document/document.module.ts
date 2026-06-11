import { Module } from '@nestjs/common';
import { DocumentController } from './api/document.controller';
import { ListDocumentsUseCase } from './application/list-documents.usecase';
import { DocumentRepository } from './infrastructure/document.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [PrismaModule],
  controllers: [DocumentController],
  providers: [
    {
      provide: 'DocumentRepository',
      useFactory: (prisma: PrismaService) => new DocumentRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ListDocumentsUseCase,
      useFactory: (repo: DocumentRepository) => new ListDocumentsUseCase(repo),
      inject: ['DocumentRepository'],
    },
  ],
  exports: ['DocumentRepository'],
})
export class DocumentModule {}
