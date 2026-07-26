import { TranslationProviderPort, TranslationRequest, TranslationResult } from '../application/translation-provider.port';
import { TranslatablePayload } from '../domain/field-policy';
import { Injectable } from '@nestjs/common';

@Injectable()
export class FakeTranslationProvider extends TranslationProviderPort {
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const { payload, targetLocale } = request;
    
    // Simulate API delay
    await new Promise(r => setTimeout(r, 100));

    const translatedPayload: TranslatablePayload = {
      insights: payload.insights.map(i => ({
        id: i.id,
        title: `[${targetLocale}] ${i.title}`,
        description: `[${targetLocale}] ${i.description}`,
      })),
      clarifications: payload.clarifications.map(c => ({
        id: c.id,
        question: `[${targetLocale}] ${c.question}`,
        answer: c.answer ? `[${targetLocale}] ${c.answer}` : null,
      })),
      reviewNotes: payload.reviewNotes.map(n => ({
        id: n.id,
        body: `[${targetLocale}] ${n.body}`,
      })),
    };

    return {
      translatedPayload,
      provider: 'FakeTranslationProvider',
      model: 'fake-deterministic-model',
      promptVersion: 'v1.0.0-fake',
    };
  }
}
