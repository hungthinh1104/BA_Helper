import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  LocalizationStatusResponse,
  RequestUser,
  SupportedReportLocale,
} from '@ba-helper/contracts';
import { ProjectPermissionService } from '../../project/application/project-permission.service';
import { ApprovedReportContextReader } from '../../document/application/queries/approved-report-context.reader';
import { LocalizationStatusRepository } from '../infrastructure/localization-status.repository';

@Injectable()
export class GetLocalizationStatusUseCase {
  constructor(
    private readonly repository: LocalizationStatusRepository,
    private readonly permissions: ProjectPermissionService,
    private readonly contextReader: ApprovedReportContextReader,
  ) {}

  async execute(params: {
    analysisId: string;
    locale: SupportedReportLocale;
    actor: RequestUser;
  }): Promise<LocalizationStatusResponse> {
    await this.permissions.assertCanReadAnalysis(
      params.actor,
      params.analysisId,
    );
    const sourceDocumentId = await this.repository.findApprovedDocumentId(
      params.analysisId,
    );
    if (!sourceDocumentId) {
      return this.status('SOURCE_NOT_READY', params.locale, null, null, null);
    }

    const localized = await this.repository.findArtifact(
      sourceDocumentId,
      params.locale,
    );
    if (!localized) {
      return this.status(
        'NOT_TRANSLATED',
        params.locale,
        sourceDocumentId,
        null,
        null,
      );
    }

    const base = {
      locale: params.locale,
      sourceDocumentId,
      errorCode: localized.errorCode,
      updatedAt: localized.updatedAt.toISOString(),
    };
    if (localized.localizationStatus !== 'COMPLETED') {
      return { ...base, status: localized.localizationStatus };
    }

    try {
      const { sourceContentHash } = await this.contextReader.readContext(
        params.analysisId,
      );
      return {
        ...base,
        status:
          localized.sourceContentHash === sourceContentHash
            ? 'READY'
            : 'OUT_OF_SYNC',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return { ...base, status: 'SOURCE_NOT_READY' };
      }
      throw error;
    }
  }

  private status(
    status: 'SOURCE_NOT_READY' | 'NOT_TRANSLATED',
    locale: SupportedReportLocale,
    sourceDocumentId: string | null,
    errorCode: null,
    updatedAt: null,
  ): LocalizationStatusResponse {
    return { status, locale, sourceDocumentId, errorCode, updatedAt };
  }
}
