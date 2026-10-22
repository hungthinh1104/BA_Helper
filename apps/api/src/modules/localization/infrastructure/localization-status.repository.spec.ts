import type { PrismaService } from '@ba-helper/backend-runtime';
import { LocalizationStatusRepository } from './localization-status.repository';

describe('LocalizationStatusRepository', () => {
  it('uses unique keys and selects only fields needed by the status projection', async () => {
    const generatedDocumentFindUnique = jest.fn(async () => ({ id: 'document-id' }));
    const localizedArtifactFindUnique = jest.fn(async () => null);
    const prisma = {
      generatedDocument: { findUnique: generatedDocumentFindUnique },
      localizedReportArtifact: { findUnique: localizedArtifactFindUnique },
    } as unknown as PrismaService;
    const repository = new LocalizationStatusRepository(prisma);

    await repository.findApprovedDocumentId('analysis-id');
    await repository.findArtifact('document-id', 'vi-VN');

    expect(generatedDocumentFindUnique).toHaveBeenCalledWith({
      where: {
        impactAnalysisId_type_status: {
          impactAnalysisId: 'analysis-id',
          type: 'IMPACT_REPORT',
          status: 'APPROVED',
        },
      },
      select: { id: true },
    });
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
});
