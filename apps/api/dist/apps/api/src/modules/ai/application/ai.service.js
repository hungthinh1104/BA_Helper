"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const app_error_1 = require("../../../shared/app-error");
const ai_schema_1 = require("../domain/ai.schema");
class AiService {
    validateResponse(params) {
        const parsed = ai_schema_1.aiResponseSchema.parse(params.response);
        const allowed = new Set(params.allowedEvidenceIds);
        const invalid = parsed.insights.flatMap((insight) => insight.evidenceIds.filter((id) => !allowed.has(id)));
        if (invalid.length > 0) {
            throw new app_error_1.AppError('INVALID_AI_EVIDENCE_REFERENCE', 'AI response referenced evidence outside the retrieved bundle.');
        }
        return parsed;
    }
}
exports.AiService = AiService;
