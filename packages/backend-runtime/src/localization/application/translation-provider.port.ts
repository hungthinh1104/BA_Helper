import { TranslatablePayload } from '../domain/field-policy';
import { DomainPack } from '@ba-helper/contracts';
import { SupportedReportLocale } from '@ba-helper/contracts';

export interface TranslationRequest {
  payload: TranslatablePayload;
  targetLocale: SupportedReportLocale;
  glossary?: DomainPack;
}

export interface TranslationResult {
  translatedPayload: TranslatablePayload;
  provider: string;
  model: string;
  promptVersion: string;
}

export abstract class TranslationProviderPort {
  abstract translate(request: TranslationRequest): Promise<TranslationResult>;
}
