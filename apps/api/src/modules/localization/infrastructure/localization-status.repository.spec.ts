import type { PrismaService } from '@ba-helper/backend-runtime';
import { LocalizationStatusRepository } from './localization-status.repository';

describe('LocalizationStatusRepository', () => {
  it('uses the latest reviewed snapshot document and selects only fields needed by the status projection', async () => {
    const reviewedSnapshotFindFirst = jest.fn(async () => ({ approvedDocumentId: 'document-id' }));
    const generatedDocumentFindFirst = jest.fn(async () => ({ id: 'legacy-document-id' }));
    const localizedArtifactFindUnique = jest.fn(async () => null);
    const prisma = {
      reviewedReportSnapshot: { findFirst: reviewedSnapshotFindFirst },
      generatedDocument: { findFirst: generatedDocumentFindFirst },
      localizedReportArtifact: { findUnique: localizedArtifactFindUnique },
    } as unknown as PrismaService;
    const repository = new LocalizationStatusRepository(prisma);

    await repository.findApprovedDocumentId('analysis-id');
    await repository.findArtifact('document-id', 'vi-VN');

    expect(reviewedSnapshotFindFirst).toHaveBeenCalledWith({
      where: { analysisId: 'analysis-id' },
      orderBy: { createdAt: 'desc' },
      select: { approvedDocumentId: true },
    });
    expect(generatedDocumentFindFirst).not.toHaveBeenCalled();
    expect(localizedArtifactFindUnique).toHaveBeenCalledWith({
      where: {
        sourceDocumentId_locale: {
          sourceDocumentId: 'document-id',
          locale: 'vi-VN',
        },
      },
      select: {
        localizationStatus: true,
        errorCode: true,
        updatedAt: true,
        sourceContentHash: true,
      },
    });
  });

  it('does not report an older document while the latest snapshot is pending', async () => {
    const generatedDocumentFindFirst = jest.fn(async () => ({ id: 'old-document-id' }));
    const repository = new LocalizationStatusRepository({
      reviewedReportSnapshot: {
        findFirst: jest.fn(async () => ({ approvedDocumentId: null })),
      },
      generatedDocument: { findFirst: generatedDocumentFindFirst },
    } as unknown as PrismaService);

    await expect(repository.findApprovedDocumentId('analysis-id')).resolves.toBeNull();
    expect(generatedDocumentFindFirst).not.toHaveBeenCalled();
  });

  it('falls back to legacy report rows when the analysis has no reviewed snapshots', async () => {
    const repository = new LocalizationStatusRepository({
      reviewedReportSnapshot: { findFirst: jest.fn(async () => null) },
      generatedDocument: {
        findFirst: jest.fn(async () => ({ id: 'legacy-document-id' })),
      },
    } as unknown as PrismaService);

    await expect(repository.findApprovedDocumentId('analysis-id')).resolves.toBe('legacy-document-id');
  });
});
