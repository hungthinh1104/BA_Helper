import type { PrismaService } from '../../prisma/prisma.service';
import { DocumentRepository } from './document.repository';

describe('DocumentRepository', () => {
  it('loads approved report context with analysis-scoped snapshot and evidence reads', async () => {
    const snapshot = { id: 'snapshot-1', analysisId: 'analysis-1', approvedDocumentId: 'document-1' };
    const document = {
      id: 'document-1', impactAnalysisId: 'analysis-1', reviewedReportSnapshotId: 'snapshot-1',
      type: 'IMPACT_REPORT', status: 'APPROVED',
    };
    const analysis = { id: 'analysis-1', snapshotId: 'repo-snapshot-1', requirementRevisionId: 'revision-1' };
    const impactAnalysisFindUnique = jest.fn().mockResolvedValue(analysis);
    const reviewedReportFindFirst = jest.fn().mockResolvedValue(snapshot);
    const generatedDocumentFindUnique = jest.fn().mockResolvedValue(document);
    const baInsightFindMany = jest.fn().mockResolvedValue([]);
    const traceabilityFindMany = jest.fn().mockResolvedValue([]);
    const reviewNoteFindMany = jest.fn().mockResolvedValue([]);
    const clarificationFindMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      impactAnalysis: { findUnique: impactAnalysisFindUnique },
      reviewedReportSnapshot: { findFirst: reviewedReportFindFirst },
      generatedDocument: { findUnique: generatedDocumentFindUnique },
      baInsight: { findMany: baInsightFindMany },
      traceabilityLink: { findMany: traceabilityFindMany },
      reviewNote: { findMany: reviewNoteFindMany },
      clarificationItem: { findMany: clarificationFindMany },
    } as unknown as PrismaService;
    const repository = new DocumentRepository(prisma);

    const result = await repository.loadApprovedReportContext('analysis-1', 'snapshot-1');

    expect(result).toMatchObject({ analysis, requestedSnapshot: snapshot, reviewedSnapshot: snapshot, document });
    expect(reviewedReportFindFirst).toHaveBeenCalledWith({ where: { id: 'snapshot-1', analysisId: 'analysis-1' } });
    expect(generatedDocumentFindUnique).toHaveBeenCalledWith({
      where: { id: 'document-1' },
      select: {
        id: true, impactAnalysisId: true, reviewedReportSnapshotId: true, type: true, status: true,
      },
    });
    expect(baInsightFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { impactAnalysisId: 'analysis-1' } }));
    expect(traceabilityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { impactAnalysisId: 'analysis-1', artifact: { snapshotId: 'repo-snapshot-1' } },
    }));
    expect(reviewNoteFindMany).toHaveBeenCalledWith({ where: { impactAnalysisId: 'analysis-1' } });
    expect(clarificationFindMany).toHaveBeenCalledWith({ where: { impactAnalysisId: 'analysis-1' } });
  });

  it('does not fall back to a different snapshot when the requested report snapshot is missing', async () => {
    const reviewedReportFindFirst = jest.fn().mockResolvedValue(null);
    const generatedDocumentFindFirst = jest.fn();
    const prisma = {
      impactAnalysis: { findUnique: jest.fn().mockResolvedValue({ id: 'analysis-1' }) },
      reviewedReportSnapshot: { findFirst: reviewedReportFindFirst },
      generatedDocument: { findFirst: generatedDocumentFindFirst },
      baInsight: { findMany: jest.fn() },
      traceabilityLink: { findMany: jest.fn() },
      reviewNote: { findMany: jest.fn() },
      clarificationItem: { findMany: jest.fn() },
    } as unknown as PrismaService;
    const repository = new DocumentRepository(prisma);

    const result = await repository.loadApprovedReportContext('analysis-1', 'missing-snapshot');

    expect(result).toMatchObject({ requestedSnapshot: null, reviewedSnapshot: null, document: null });
    expect(reviewedReportFindFirst).toHaveBeenCalledTimes(1);
    expect(generatedDocumentFindFirst).not.toHaveBeenCalled();
  });

  it('scopes reviewed snapshot reads by both snapshot and analysis identity', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'snapshot-1', analysisId: 'analysis-1' });
    const prisma = {
      reviewedReportSnapshot: { findFirst },
    } as unknown as PrismaService;
    const repository = new DocumentRepository(prisma);

    await repository.findReviewedReportSnapshotById('analysis-1', 'snapshot-1');

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'snapshot-1', analysisId: 'analysis-1' },
    });
  });

  it('scopes completed report jobs by analysis and generated document', async () => {
    const findMany = jest.fn().mockResolvedValue([{ snapshotId: 'snapshot-1' }]);
    const prisma = {
      documentJob: { findMany },
    } as unknown as PrismaService;
    const repository = new DocumentRepository(prisma);

    await repository.findCompletedJobsForApprovedReport('analysis-1', 'document-1');

    expect(findMany).toHaveBeenCalledWith({
      where: { analysisId: 'analysis-1', generatedDocumentId: 'document-1', status: 'COMPLETED' },
      select: { snapshotId: true },
    });
  });

  it('reads the most recent report job only for the requested snapshot', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = {
      documentJob: { findFirst },
    } as unknown as PrismaService;
    const repository = new DocumentRepository(prisma);

    await repository.findLatestJobForSnapshot('snapshot-1');

    expect(findFirst).toHaveBeenCalledWith({
      where: { snapshotId: 'snapshot-1', documentType: 'IMPACT_REPORT' },
      orderBy: { updatedAt: 'desc' },
      include: { generatedDocument: true },
    });
  });

  it('loads localized report text by source document and locale', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const prisma = {
      localizedReportArtifact: { findUnique },
    } as unknown as PrismaService;
    const repository = new DocumentRepository(prisma);

    await repository.findLocalizedReportArtifact('document-1', 'vi-VN');

    expect(findUnique).toHaveBeenCalledWith({
      where: { sourceDocumentId_locale: { sourceDocumentId: 'document-1', locale: 'vi-VN' } },
    });
  });

  it('loads the document provenance fields required by the report boundary', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const prisma = {
      generatedDocument: { findUnique },
    } as unknown as PrismaService;
    const repository = new DocumentRepository(prisma);

    await repository.findGeneratedDocumentById('document-1');

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'document-1' },
      select: {
        id: true,
        impactAnalysisId: true,
        reviewedReportSnapshotId: true,
        type: true,
        status: true,
        content: true,
      },
    });
  });
});
