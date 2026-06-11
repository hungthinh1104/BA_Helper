"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequirementPolicy = void 0;
const app_error_1 = require("../../../shared/app-error");
const secretPatterns = [
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN\s+PRIVATE\s+KEY-----/,
    /password\s*=/i,
];
exports.RequirementPolicy = {
    validateRevisionInput: (params) => {
        if (!params.title.trim()) {
            throw new app_error_1.AppError('INVALID_REQUIREMENT_INPUT', 'Requirement title is required.');
        }
        if (!params.rawText.trim()) {
            throw new app_error_1.AppError('INVALID_REQUIREMENT_INPUT', 'Requirement text is required.');
        }
        if (secretPatterns.some((pattern) => pattern.test(params.rawText))) {
            throw new app_error_1.AppError('INVALID_REQUIREMENT_INPUT', 'Requirement text contains potential secrets.');
        }
    },
    qualifyReadiness: (rawText) => {
        const normalized = rawText.trim().toLowerCase();
        if (normalized.length < 10) {
            return {
                status: 'NEEDS_CLARIFICATION',
                issues: ['Requirement text is too vague.'],
            };
        }
        if (!/cancel|refund|booking|payment/.test(normalized)) {
            return {
                status: 'NEEDS_CLARIFICATION',
                issues: ['Requirement text lacks actionable domain terms.'],
            };
        }
        return { status: 'READY_FOR_ANALYSIS', issues: [] };
    },
    enforceImmutableRevision: () => {
        throw new app_error_1.AppError('IMMUTABLE_REVISION', 'Requirement revisions are immutable. Create a new revision instead.');
    },
};
