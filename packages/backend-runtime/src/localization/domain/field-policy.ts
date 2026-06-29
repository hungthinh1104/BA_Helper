import { MarkdownReportRenderContext, InsightWithEvidence } from '../../document/application/markdown-impact-report.types';
import { z } from 'zod';

/**
 * Representation of the extracted translatable fields.
 * This is what will be sent to the LLM for translation.
 */
export const translatablePayloadSchema = z.object({
  insights: z.array(z.object({
    id: z.string().uuid(), // Required to map back, but NOT translated
    title: z.string(),
    description: z.string(),
  })),
  clarifications: z.array(z.object({
    id: z.string().uuid(), // Required to map back
    question: z.string(),
    answer: z.string().nullable(),
  })),
  reviewNotes: z.array(z.object({
    id: z.string().uuid(), // Required to map back
    body: z.string(),
  })),
});

export type TranslatablePayload = z.infer<typeof translatablePayloadSchema>;

/**
 * Extracts only the safe, translatable human-facing text from the canonical context.
 */
export function extractTranslatableFields(context: MarkdownReportRenderContext): TranslatablePayload {
  return {
    insights: context.insights.map(i => ({
      id: i.id,
      title: i.title,
      description: i.description,
    })),
    clarifications: context.clarifications.map(c => ({
      id: c.id,
      question: c.question,
      answer: c.answer,
    })),
    reviewNotes: context.reviewNotes.map(n => ({
      id: n.id,
      body: n.body,
    })),
  };
}

/**
 * Merges the translated text back into a clone of the canonical context.
 * It strictly ignores any structural changes from the translated payload (like IDs),
 * by looking up the translated values by ID and updating only the allowed text fields.
 */
export function mergeTranslatedFields(
  canonicalContext: MarkdownReportRenderContext,
  translatedPayload: TranslatablePayload
): MarkdownReportRenderContext {
  // Deep clone to avoid mutating the canonical context
  const localizedContext: MarkdownReportRenderContext = JSON.parse(JSON.stringify(canonicalContext));

  const insightMap = new Map(translatedPayload.insights.map(i => [i.id, i]));
  localizedContext.insights.forEach(insight => {
    const translation = insightMap.get(insight.id);
    if (translation) {
      insight.title = translation.title;
      insight.description = translation.description;
    }
  });

  const clarificationMap = new Map(translatedPayload.clarifications.map(c => [c.id, c]));
  localizedContext.clarifications.forEach(clarif => {
    const translation = clarificationMap.get(clarif.id);
    if (translation) {
      clarif.question = translation.question;
      if (translation.answer !== null) {
        clarif.answer = translation.answer;
      }
    }
  });

  const noteMap = new Map(translatedPayload.reviewNotes.map(n => [n.id, n]));
  localizedContext.reviewNotes.forEach(note => {
    const translation = noteMap.get(note.id);
    if (translation) {
      note.body = translation.body;
    }
  });

  return localizedContext;
}
