import { Controller, Get, Param } from '@nestjs/common';
import { documentListResponseSchema } from '@ba-helper/contracts';
import { ListDocumentsUseCase } from '../application/list-documents.usecase';
import { GetApprovedReportUseCase } from '../application/get-approved-report.usecase';
import { ExportApprovedReportUseCase } from '../application/export-approved-report.usecase';
import { approvedImpactReportResponseSchema } from '@ba-helper/contracts';
import { DocumentMapper } from './document.mapper';
import { Res } from '@nestjs/common';

@Controller('/api/v1')
export class DocumentController {
  constructor(
    private readonly listDocuments: ListDocumentsUseCase,
    private readonly getApprovedReport: GetApprovedReportUseCase,
    private readonly exportApprovedReport: ExportApprovedReportUseCase,
  ) {}

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

  @Get('/impact-analyses/:analysisId/approved-report')
  async getApprovedReportEndpoint(@Param('analysisId') analysisId: string) {
    const result = await this.getApprovedReport.execute(analysisId);
    
    const mapped = DocumentMapper.toApprovedReportResponse(
      result.report,
      result.isStale,
      result.staleReason,
    );

    return approvedImpactReportResponseSchema.parse(mapped);
  }

  @Get('/impact-analyses/:analysisId/approved-report/export.md')
  async exportApprovedReportEndpoint(
    @Param('analysisId') analysisId: string,
    @Res() res: any,
  ) {
    // Pass actorId as 'dev-single-user' for MVP since we have no auth
    const result = await this.exportApprovedReport.execute(analysisId, 'dev-single-user');

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    
    // If we wanted to add a stale header metadata, we could do it here
    if (result.isStale) {
      res.setHeader('X-Report-Stale', 'true');
    }

    res.send(result.markdown);
  }
}
