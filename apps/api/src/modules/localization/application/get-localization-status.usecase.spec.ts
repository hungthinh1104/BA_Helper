import { NotFoundException } from '@nestjs/common';
import type { RequestUser } from '@ba-helper/contracts';
import { GetLocalizationStatusUseCase } from './get-localization-status.usecase';

describe('GetLocalizationStatusUseCase', () => {
  const actor = { id: 'user-id', role: 'REVIEWER' } as RequestUser;

  it('returns NOT_TRANSLATED without loading report context', async () => {
    const repository = {
      findApprovedDocumentId: jest.fn(async () => 'document-id'),
      findArtifact: jest.fn(async () => null),
    };
    const permissions = {
      assertCanReadAnalysis: jest.fn(async () => undefined),
    };
    const contextReader = { readContext: jest.fn(async () => ({} as never)) };
    const useCase = new GetLocalizationStatusUseCase(
      repository as never,
      permissions as never,
      contextReader as never,
    );

    await expect(
      useCase.execute({ analysisId: 'analysis-id', locale: 'vi-VN', actor }),
    ).resolves.toEqual({
      status: 'NOT_TRANSLATED',
      locale: 'vi-VN',
      sourceDocumentId: 'document-id',
      errorCode: null,
      updatedAt: null,
    });
    expect(permissions.assertCanReadAnalysis).toHaveBeenCalledWith(
      actor,
      'analysis-id',
    );
    expect(contextReader.readContext).not.toHaveBeenCalled();
  });

  it('marks missing source context but propagates infrastructure errors', async () => {
    const repository = {
      findApprovedDocumentId: jest.fn(async () => 'document-id'),
      findArtifact: jest.fn(async () => ({
        localizationStatus: 'COMPLETED',
        errorCode: null,
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        sourceContentHash: 'source-hash',
      })),
    };
    const permissions = {
      assertCanReadAnalysis: jest.fn(async () => undefined),
    };
    const contextReader = {
      readContext: jest.fn(async () => {
        throw new NotFoundException('source missing');
      }),
    };
    const useCase = new GetLocalizationStatusUseCase(
      repository as never,
      permissions as never,
      contextReader as never,
    );

    await expect(
      useCase.execute({ analysisId: 'analysis-id', locale: 'vi-VN', actor }),
    ).resolves.toMatchObject({ status: 'SOURCE_NOT_READY' });

    contextReader.readContext.mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    await expect(
      useCase.execute({ analysisId: 'analysis-id', locale: 'vi-VN', actor }),
    ).rejects.toThrow('database unavailable');
  });
});
