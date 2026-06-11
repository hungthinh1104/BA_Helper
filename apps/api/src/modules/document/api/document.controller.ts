import { Controller, Get, Param } from '@nestjs/common';
import { documentListResponseSchema } from '@ba-helper/contracts';
import { ListDocumentsUseCase } from '../application/list-documents.usecase';
import { GetApprovedReportUseCase } from '../application/get-approved-report.usecase';
import { ExportApprovedReportUseCase } from '../application/export-approved-report.usecase';
import { approvedImpactReportResponseSchema, RequestUser } from '@ba-helper/contracts';
import { DocumentMapper } from './document.mapper';
import { Res } from '@nestjs/common';
import { CurrentUser } from '../../auth/api/current-user.decorator';

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

    const mapped = DocumentMapper.toApprovedReportResponse(result.report, result.metadata);

    return approvedImpactReportResponseSchema.parse(mapped);
  }

  @Get('/impact-analyses/:analysisId/approved-report/export.md')
  async exportApprovedReportEndpoint(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
    @Res() res: any,
  ) {
    const result = await this.exportApprovedReport.execute({
      analysisId,
      actor,
      format: 'markdown',
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  }

  @Get('/impact-analyses/:analysisId/approved-report/export.pdf')
  async exportApprovedReportPdfEndpoint(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
    @Res() res: any,
  ) {
    const result = await this.exportApprovedReport.execute({
      analysisId,
      actor,
      format: 'pdf',
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  }
}
