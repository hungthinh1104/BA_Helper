import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import type {
  LocalizationStatusResponse,
  LocalizedReportArtifact,
  RequestUser,
} from '@ba-helper/contracts';
import { ROLES_KEY } from '../auth/api/roles.decorator';
import { LocalizationController } from './localization.controller';

describe('LocalizationController', () => {
  const actor = { id: 'user-id', role: 'REVIEWER' } as RequestUser;

  it('requires a writer role and delegates report generation', async () => {
    const artifact = {
      localizationStatus: 'COMPLETED',
    } as unknown as LocalizedReportArtifact;
    const generate = { execute: jest.fn(async () => artifact) };
    const getStatus = {
      execute: jest.fn(async () => ({
        status: 'READY',
        locale: 'vi-VN',
        sourceDocumentId: null,
        errorCode: null,
        updatedAt: null,
      }) satisfies LocalizationStatusResponse),
    };
    const controller = new LocalizationController(
      generate as never,
      getStatus as never,
    );

    await controller.generateLocalizedReport(
      'analysis-id',
      { locale: 'vi-VN' },
      actor,
    );

    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        LocalizationController.prototype.generateLocalizedReport,
      ),
    ).toEqual(['ADMIN', 'REVIEWER']);
    expect(generate.execute).toHaveBeenCalledWith({
      analysisId: 'analysis-id',
      actor,
      locale: 'vi-VN',
    });
  });

  it('rejects unsupported locale path segments before calling the status use case', async () => {
    const getStatus = { execute: jest.fn(async () => ({}) as never) };
    const controller = new LocalizationController({} as never, getStatus as never);

    await expect(
      controller.getLocalizationStatus('analysis-id', 'xx-INVALID', actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(getStatus.execute).not.toHaveBeenCalled();
  });
});
