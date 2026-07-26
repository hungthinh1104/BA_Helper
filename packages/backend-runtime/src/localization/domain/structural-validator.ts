import { TranslatablePayload } from './field-policy';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class StructuralValidator {
  private readonly logger = new Logger(StructuralValidator.name);
  readonly version = 'v1.0.0';

  /**
   * Validates that the translated payload maintains structural integrity
   * with the original payload (same IDs, same array lengths).
   */
  validate(original: TranslatablePayload, translated: TranslatablePayload): boolean {
    try {
      if (original.insights.length !== translated.insights.length) return false;
      if (original.clarifications.length !== translated.clarifications.length) return false;
      if (original.reviewNotes.length !== translated.reviewNotes.length) return false;

      // Check Insight IDs
      const origInsightIds = new Set(original.insights.map(i => i.id));
      for (const i of translated.insights) {
        if (!origInsightIds.has(i.id)) return false;
      }

      // Check Clarification IDs
      const origClarifIds = new Set(original.clarifications.map(c => c.id));
      for (const c of translated.clarifications) {
        if (!origClarifIds.has(c.id)) return false;
      }

      // Check ReviewNote IDs
      const origNoteIds = new Set(original.reviewNotes.map(n => n.id));
      for (const n of translated.reviewNotes) {
        if (!origNoteIds.has(n.id)) return false;
      }

      return true;
    } catch (e) {
      this.logger.error('Structural validation threw an error', e);
      return false;
    }
  }
}
