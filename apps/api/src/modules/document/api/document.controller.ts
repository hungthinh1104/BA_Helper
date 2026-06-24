import { Controller, Get, Param, Post, Body, Res } from '@nestjs/common';
import { documentListResponseSchema } from '@ba-helper/contracts';
import { ListDocumentsUseCase } from '../application/queries/list-documents.usecase';
import { GetApprovedReportUseCase } from '../application/get-approved-report.usecase';
import { ExportApprovedReportUseCase } from '../application/export-approved-report.usecase';
import { CreateReviewedReportSnapshotUseCase } from '../application/commands/create-reviewed-report-snapshot.usecase';
import { GetLatestReviewedReportSnapshotUseCase } from '../application/queries/get-latest-reviewed-report-snapshot.usecase';
import { GetFinalReviewedReportUseCase } from '../application/queries/get-final-reviewed-report.usecase';
import { EnqueueDocumentJobUseCase } from '../application/commands/enqueue-document-job.usecase';
import { 
  approvedImpactReportResponseSchema, 
  reviewedReportSnapshotSchema, 
  finalReviewedReportResponseSchema,
  documentJobSchema,
  RequestUser 
} from '@ba-helper/contracts';
import { DocumentMapper } from './document.mapper';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { ProjectPermissionService } from '../../project/application/project-permission.service';

@Controller('/api/v1')
export class DocumentController {
  constructor(
    private readonly listDocuments: ListDocumentsUseCase,
    private readonly getApprovedReport: GetApprovedReportUseCase,
    private readonly exportApprovedReport: ExportApprovedReportUseCase,
    private readonly createReviewedReportSnapshot: CreateReviewedReportSnapshotUseCase,
    private readonly getLatestReviewedReportSnapshot: GetLatestReviewedReportSnapshotUseCase,
    private readonly getFinalReviewedReport: GetFinalReviewedReportUseCase,
    private readonly enqueueDocumentJob: EnqueueDocumentJobUseCase,
    private readonly permissions: ProjectPermissionService,
  ) {}

  @Get('/impact-analyses/:analysisId/documents')
  async list(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadAnalysis(actor, analysisId);
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
  async getApprovedReportEndpoint(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadAnalysis(actor, analysisId);
    const result = await this.getApprovedReport.execute(analysisId);

    const mapped = DocumentMapper.toApprovedReportResponse(result);

    return approvedImpactReportResponseSchema.parse(mapped);
  }

  @Get('/impact-analyses/:analysisId/approved-report/export.md')
  async exportApprovedReportEndpoint(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
    @Res() res: any,
  ) {
    await this.permissions.assertPermissionForAnalysis(
      actor,
      analysisId,
      'report:export',
    );
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
    await this.permissions.assertPermissionForAnalysis(
      actor,
      analysisId,
      'report:export',
    );
    const result = await this.exportApprovedReport.execute({
      analysisId,
      actor,
      format: 'pdf',
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  }

  @Post('/impact-analyses/:analysisId/reviewed-report-snapshot')
  async createSnapshot(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    // Requires finalize permission as snapshotting is an audit/finalize action
    await this.permissions.assertPermissionForAnalysis(actor, analysisId, 'analysis:finalize');
    
    const snapshot = await this.createReviewedReportSnapshot.execute({
      analysisId,
      createdByUserId: actor.id,
    });

    const mapped = DocumentMapper.toReviewedReportSnapshotResponse(snapshot);
    return reviewedReportSnapshotSchema.parse(mapped);
  }

  @Get('/impact-analyses/:analysisId/reviewed-report-snapshot/latest')
  async getLatestSnapshot(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadAnalysis(actor, analysisId);
    
    const snapshot = await this.getLatestReviewedReportSnapshot.execute(analysisId);

    const mapped = DocumentMapper.toReviewedReportSnapshotResponse(snapshot);
    return reviewedReportSnapshotSchema.parse(mapped);
  }

  @Get('/impact-analyses/:analysisId/final-reviewed-report')
  async getFinalReviewedReportGate(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadAnalysis(actor, analysisId);
    
    const result = await this.getFinalReviewedReport.execute(analysisId);
    
    return finalReviewedReportResponseSchema.parse(result);
  }

  @Post('/impact-analyses/:analysisId/document-jobs')
  async enqueueJob(
    @Param('analysisId') analysisId: string,
    @CurrentUser() actor: RequestUser,
    @Body() body: any,
  ) {
    await this.permissions.assertPermissionForAnalysis(actor, analysisId, 'report:export');
    
    const job = await this.enqueueDocumentJob.execute({
      analysisId,
      documentType: 'IMPACT_REPORT',
      requestKey: body?.requestKey,
      retry: body?.retry === true,
    });

    return documentJobSchema.parse({
      id: job.id,
      analysisId: job.analysisId,
      snapshotId: job.snapshotId,
      documentType: job.documentType,
      status: job.status,
      progress: job.progress,
      requestKey: job.requestKey,
      attemptCount: job.attemptCount,
      error: job.error,
      generatedDocumentId: job.generatedDocumentId,
      lastStartedAt: job.lastStartedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      failedAt: job.failedAt?.toISOString(),
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    });
  }
}
