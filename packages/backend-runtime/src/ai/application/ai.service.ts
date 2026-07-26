import { AppError } from '@ba-helper/shared';
import { impactAnalysisAiSchema, type ImpactAnalysisAiResponse } from '../domain/ai.schema';

export class AiService {
  validateResponse(params: {
    response: unknown;
    allowedEvidenceKeys: string[];
  }): ImpactAnalysisAiResponse {
    const parsed = impactAnalysisAiSchema.parse(params.response);

    const allowed = new Set(params.allowedEvidenceKeys);
    const invalid = parsed.insights.flatMap((insight) =>
      (insight.evidenceKeys || []).filter((key: string) => !allowed.has(key)),
    );

    if (invalid.length > 0) {
      throw new AppError(
        'INVALID_AI_EVIDENCE_REFERENCE',
        'AI response referenced evidence outside the retrieved bundle.',
      );
    }

    return parsed;
  }
}
