import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApprovedReportMetadata } from '../domain/approved-report-metadata';

@Injectable()
export class ApprovedReportProjectionService {
  constructor(private readonly prisma: PrismaService) {}

  async project(report: any): Promise<{
    report: any;
    isStale: boolean;
    staleReason?: string;
    metadata: ApprovedReportMetadata;
  }> {
    const analysis = report.impactAnalysis;
    const isPinnedCommit = analysis.sourceTarget.resolvedRefType === 'COMMIT';

    let staleReason: string | undefined;
    let isStale =
      !isPinnedCommit &&
      !!analysis.sourceTarget.latestObservedCommitSha &&
      analysis.sourceTarget.latestObservedCommitSha !== analysis.snapshot.commitSha;

    if (isStale) {
      staleReason = 'Source target has advanced to a newer commit since analysis.';
    }

    const latestDecision = await this.prisma.analysisReviewDecision.findFirst({
      where: { analysisId: analysis.id },
      orderBy: { createdAt: 'desc' },
    });

    if (latestDecision && report.updatedAt < latestDecision.createdAt) {
      isStale = true;
      staleReason = 'Review decisions changed after the approved report snapshot was generated.';
    }

    return {
      report,
      isStale,
      staleReason,
      metadata: {
        analysisId: analysis.id,
        title: analysis.requirementRevision.title,
        projectId: analysis.requirementRevision.requirement.projectId,
        repositoryId: analysis.snapshot.repositoryId,
        targetRef: analysis.sourceTarget.requestedRef,
        commitSha: analysis.snapshot.commitSha,
        snapshotId: analysis.snapshot.id,
        analyzerVersion: analysis.snapshot.analyzerVersion,
        generatedDocumentId: report.id,
        generatedAt: report.createdAt.toISOString(),
        finalizedAt: report.updatedAt.toISOString(),
        staleStatusAtReadTime: isStale,
        staleReason,
      },
    };
  }
}
