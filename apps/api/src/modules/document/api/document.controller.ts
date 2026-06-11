import { Controller, Get, Param } from '@nestjs/common';
import { documentListResponseSchema } from '@ba-helper/contracts';
import { ListDocumentsUseCase } from '../application/list-documents.usecase';

@Controller('/api/v1')
export class DocumentController {
  constructor(private readonly listDocuments: ListDocumentsUseCase) {}

  @Get('/impact-analyses/:analysisId/documents')
  async list(@Param('analysisId') analysisId: string) {
    const docs = await this.listDocuments.execute(analysisId);
    const mapped = docs.map((doc: {
      id: string;
      type: string;
      status: string;
      impactAnalysis: {
        snapshot: { commitSha: string };
        sourceTarget: {
          resolvedRefType: string;
          latestObservedCommitSha: string;
        };
      };
    }) => ({
      id: doc.id,
      type: doc.type,
      status: doc.status,
      commitSha: doc.impactAnalysis.snapshot.commitSha,
      isStale:
        doc.impactAnalysis.sourceTarget.resolvedRefType !== 'COMMIT' &&
        doc.impactAnalysis.sourceTarget.latestObservedCommitSha !==
          doc.impactAnalysis.snapshot.commitSha,
    }));

    return documentListResponseSchema.parse({ items: mapped });
  }
}
