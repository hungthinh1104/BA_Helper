import { Injectable } from '@nestjs/common';
import type {
  LocalizedReportArtifact,
  RequestUser,
  SupportedReportLocale,
} from '@ba-helper/contracts';
import { ReportLocalizationService } from '@ba-helper/backend-runtime';
import { ProjectPermissionService } from '../../project/application/project-permission.service';
import { ApprovedReportContextReader } from '../../document/application/queries/approved-report-context.reader';

@Injectable()
export class GenerateLocalizedReportUseCase {
  constructor(
    private readonly localization: ReportLocalizationService,
    private readonly permissions: ProjectPermissionService,
    private readonly contextReader: ApprovedReportContextReader,
  ) {}

  async execute(params: {
    analysisId: string;
    actor: RequestUser;
    locale: SupportedReportLocale;
  }): Promise<LocalizedReportArtifact> {
    await this.permissions.assertPermissionForAnalysis(
      params.actor,
      params.analysisId,
      'report:export',
    );
    const { sourceDocument, canonicalContext } =
      await this.contextReader.readContext(params.analysisId);

    return this.localization.localizeReport(
      sourceDocument.id,
      canonicalContext,
      params.locale,
    );
  }
}
