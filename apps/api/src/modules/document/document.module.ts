import { Module } from '@nestjs/common';
import { DocumentController } from './api/document.controller';
import { ListDocumentsUseCase } from './application/list-documents.usecase';
import { GetApprovedReportUseCase } from './application/get-approved-report.usecase';
import { DocumentRepository } from './infrastructure/document.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [PrismaModule],
  controllers: [DocumentController],
  providers: [
    DocumentRepository,
    {
      provide: ListDocumentsUseCase,
      useFactory: (repo: DocumentRepository) => new ListDocumentsUseCase(repo),
      inject: [DocumentRepository],
    },
    {
      provide: GetApprovedReportUseCase,
      useFactory: (repo: DocumentRepository) => new GetApprovedReportUseCase(repo),
      inject: [DocumentRepository],
    },
  ],
  exports: [DocumentRepository],
})
export class DocumentModule {}
