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
    const createdAt = new Date('2026-10-30T00:00:00.000Z');
    const updatedAt = new Date('2026-10-30T00:00:00.000Z');
    const artifact = {
      id: '00000000-0000-4000-8000-000000000001',
      sourceDocumentId: '00000000-0000-4000-8000-000000000002',
      locale: 'vi-VN',
      sourceLocale: 'en-US',
      localizationStatus: 'COMPLETED',
      contentMarkdown: '# Báo cáo',
      sourceContentHash: 'source-hash',
      glossaryVersion: null,
      provider: null,
      model: null,
      translationPromptVersion: null,
      structuralValidatorVersion: null,
      fieldPolicyVersion: null,
      errorCode: null,
      createdAt,
      updatedAt,
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

    await expect(controller.generateLocalizedReport(
      'analysis-id',
      { locale: 'vi-VN' },
      actor,
    )).resolves.toEqual({
      ...artifact,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });

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

  it('returns a localization status conforming to the shared response contract', async () => {
    const status: LocalizationStatusResponse = {
      status: 'READY',
      locale: 'vi-VN',
      sourceDocumentId: null,
      errorCode: null,
      updatedAt: null,
    };
    const getStatus = { execute: jest.fn(async () => status) };
    const controller = new LocalizationController({} as never, getStatus as never);

    await expect(
      controller.getLocalizationStatus('analysis-id', 'vi-VN', actor),
    ).resolves.toEqual(status);
  });

  it('rejects a localized artifact that does not match the shared response contract', async () => {
    const generate = {
      execute: jest.fn(async () => ({ localizationStatus: 'COMPLETED' }) as never),
    };
    const controller = new LocalizationController(generate as never, {} as never);

    await expect(
      controller.generateLocalizedReport('analysis-id', { locale: 'vi-VN' }, actor),
    ).rejects.toMatchObject({ name: 'ZodError' });
  });

  it('rejects a localization status that does not match the shared response contract', async () => {
    const getStatus = { execute: jest.fn(async () => ({ status: 'READY' }) as never) };
    const controller = new LocalizationController({} as never, getStatus as never);

    await expect(
      controller.getLocalizationStatus('analysis-id', 'vi-VN', actor),
    ).rejects.toMatchObject({ name: 'ZodError' });
  });
});
