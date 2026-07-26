import { Injectable, Logger } from '@nestjs/common';
import { TranslationProviderPort } from './translation-provider.port';
import { StructuralValidator } from '../domain/structural-validator';
import { extractTranslatableFields, mergeTranslatedFields } from '../domain/field-policy';
import { computeCanonicalReportHash } from '../domain/report-hash';
import { MarkdownReportRenderContext } from '../../document/application/markdown-impact-report.types';
import { MarkdownImpactReportBuilder } from '../../document/application/render/markdown-impact-report.builder';
import { SupportedReportLocale, LocalizedReportArtifact } from '@ba-helper/contracts';
import { LocalizedArtifactRepository } from '../infrastructure/localized-artifact.repository';
import { DomainPackRegistry } from '../../domain-pack/application/domain-pack.registry';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportLocalizationService {
  private readonly logger = new Logger(ReportLocalizationService.name);

  constructor(
    private readonly translationProvider: TranslationProviderPort,
    private readonly validator: StructuralValidator,
    private readonly reportBuilder: MarkdownImpactReportBuilder,
    private readonly artifactRepo: LocalizedArtifactRepository,
    private readonly domainPackRegistry: DomainPackRegistry,
    private readonly prisma: PrismaService,
  ) {}

  async localizeReport(
    sourceDocumentId: string,
    canonicalContext: MarkdownReportRenderContext,
    targetLocale: SupportedReportLocale
  ): Promise<LocalizedReportArtifact> {
    const sourceContentHash = computeCanonicalReportHash(canonicalContext);

    // Check if we already have a valid completed translation for this hash
    const existing = await this.artifactRepo.findByDocumentAndLocale(sourceDocumentId, targetLocale);
    if (existing && existing.localizationStatus === 'COMPLETED' && existing.sourceContentHash === sourceContentHash) {
      return existing; // Serve cache
    }

    // Fail closed if domain pack / glossary is not stable for the domain (MVP specific)
    const profileDomain = canonicalContext.analysis.snapshot.profile?.domain;
    const domainPackSelection = this.domainPackRegistry.selectPack({
      manualPackId: canonicalContext.analysis.requestedDomainPackId,
      repositoryProfileDomain: profileDomain,
    });
    
    // Fail closed only if there is no pack at all (no ID), not just because it's general-purpose
    // FALLBACK = GeneralDomainPack which is still usable for translation without a domain glossary.
    if (!domainPackSelection.pack.id) {
      return this.failLocalization(
        sourceDocumentId,
        targetLocale,
        sourceContentHash,
        'GLOSSARY_NOT_AVAILABLE',
        existing?.id,
      );
    }

    try {
      // 1. Extract Translatable Fields
      const payloadToTranslate = extractTranslatableFields(canonicalContext);

      // 2. Call Translation Provider
      const translationResult = await this.translationProvider.translate({
        payload: payloadToTranslate,
        targetLocale,
        glossary: domainPackSelection.pack,
      });

      // 3. Validate Structural Integrity
      const isValid = this.validator.validate(payloadToTranslate, translationResult.translatedPayload);
      if (!isValid) {
        return this.failLocalization(
          sourceDocumentId, 
          targetLocale, 
          sourceContentHash, 
          'STRUCTURAL_VALIDATION_FAILED',
          existing?.id,
          translationResult
        );
      }

      // 4. Re-merge Translated Text with Canonical Structural Data
      const localizedContext = mergeTranslatedFields(canonicalContext, translationResult.translatedPayload);
      // Ensure locale is updated for rendering (mapping vi-VN to vi if needed)
      localizedContext.locale = targetLocale.startsWith('vi') ? 'vi-VN' : 'en';

      // 5. Render Final Markdown
      const contentMarkdown = this.reportBuilder.build(localizedContext);

      // 6. Persist Localized Artifact
      const artifact = await this.artifactRepo.upsert({
        id: existing?.id,
        sourceDocumentId,
        locale: targetLocale,
        sourceLocale: 'en',
        localizationStatus: 'COMPLETED',
        contentMarkdown,
        sourceContentHash,
        glossaryVersion: domainPackSelection.pack.version,
        provider: translationResult.provider,
        model: translationResult.model,
        translationPromptVersion: translationResult.promptVersion,
        structuralValidatorVersion: this.validator.version,
        fieldPolicyVersion: 'v1.0.0',
        errorCode: null,
      });

      return artifact;

    } catch (e) {
      this.logger.error(`Localization failed for document ${sourceDocumentId}`, e);
      return this.failLocalization(
        sourceDocumentId, 
        targetLocale, 
        sourceContentHash, 
        'TRANSLATION_PROVIDER_FAILED',
        existing?.id
      );
    }
  }

  private async failLocalization(
    sourceDocumentId: string,
    locale: SupportedReportLocale,
    sourceContentHash: string,
    errorCode: string,
    existingId?: string,
    translationResult?: any,
  ): Promise<LocalizedReportArtifact> {
    return this.artifactRepo.upsert({
      id: existingId,
      sourceDocumentId,
      locale,
      sourceLocale: 'en',
      localizationStatus: 'FAILED',
      contentMarkdown: null,
      sourceContentHash,
      glossaryVersion: null,
      provider: translationResult?.provider ?? null,
      model: translationResult?.model ?? null,
      translationPromptVersion: translationResult?.promptVersion ?? null,
      structuralValidatorVersion: this.validator.version,
      fieldPolicyVersion: 'v1.0.0',
      errorCode,
    });
  }
}
