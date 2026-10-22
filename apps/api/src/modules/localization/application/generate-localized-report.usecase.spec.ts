import type {
  LocalizedReportArtifact,
  RequestUser,
} from '@ba-helper/contracts';
import { GenerateLocalizedReportUseCase } from './generate-localized-report.usecase';

describe('GenerateLocalizedReportUseCase', () => {
  it('checks report-export permission before translating approved report context', async () => {
    const actor = { id: 'user-id', role: 'REVIEWER' } as RequestUser;
    const artifact = {
      localizationStatus: 'COMPLETED',
    } as unknown as LocalizedReportArtifact;
    const permissions = {
      assertPermissionForAnalysis: jest.fn(async () => undefined),
    };
    const contextReader = {
      readContext: jest.fn(async () => ({
        sourceDocument: { id: 'document-id' },
        canonicalContext: {},
      })),
    };
    const localization = {
      localizeReport: jest.fn(async () => artifact),
    };
    const useCase = new GenerateLocalizedReportUseCase(
      localization as never,
      permissions as never,
      contextReader as never,
    );

    await useCase.execute({
      analysisId: 'analysis-id',
      actor,
      locale: 'vi-VN',
    });

    expect(permissions.assertPermissionForAnalysis).toHaveBeenCalledWith(
      actor,
      'analysis-id',
      'report:export',
    );
    expect(localization.localizeReport).toHaveBeenCalledWith(
      'document-id',
      {},
      'vi-VN',
    );
  });
});
