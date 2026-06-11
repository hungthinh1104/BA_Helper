import { DocumentRepository } from '../infrastructure/document.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { AppError } from '../../../shared/app-error';
import { sanitizeReportFilename } from '../domain/sanitize-filename.util';
import { DocumentExportedEventPayload } from '../domain/document.events';
import * as crypto from 'crypto';

export class ExportApprovedReportUseCase {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(analysisId: string, actorId: string = 'dev-single-user') {
    const report = await this.documentRepository.findApprovedReportByAnalysisId(analysisId);

    if (!report) {
      throw new AppError('APPROVED_REPORT_NOT_FOUND', 'Approved impact report not found.');
    }

    const analysis = report.impactAnalysis;
    const isPinnedCommit = analysis.sourceTarget.resolvedRefType === 'COMMIT';

    let isStale =
      !isPinnedCommit &&
      !!analysis.sourceTarget.latestObservedCommitSha &&
      analysis.sourceTarget.latestObservedCommitSha !== analysis.snapshot.commitSha;

    const latestDecision = await this.prisma.analysisReviewDecision.findFirst({
      where: { analysisId },
      orderBy: { createdAt: 'desc' },
    });

    if (latestDecision && report.updatedAt < latestDecision.createdAt) {
      isStale = true;
    }

    const filename = sanitizeReportFilename(analysis.requirementRevision.title);

    const eventPayload: DocumentExportedEventPayload = {
      eventType: 'DOCUMENT_EXPORTED',
      impactAnalysisId: analysis.id,
      documentId: report.id,
      repositoryId: analysis.snapshot.repositoryId,
      snapshotId: analysis.snapshot.id,
      commitSha: analysis.snapshot.commitSha,
      format: 'markdown',
      exportedAt: new Date().toISOString(),
      filename,
      isStale,
      actorId,
    };

    try {
      await this.prisma.domainEvent.create({
        data: {
          eventType: eventPayload.eventType,
          idempotencyKey: crypto.randomUUID(), // Generic uuid since exports can happen multiple times
          payload: eventPayload as any,
        },
      });
    } catch (err) {
      // Do not block export if event insertion fails, but log it
      console.warn('Failed to record DOCUMENT_EXPORTED audit event:', err);
    }

    return {
      markdown: report.content,
      filename,
      isStale,
    };
  }
}
