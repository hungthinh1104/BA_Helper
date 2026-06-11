"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvidencePolicy = void 0;
const app_error_1 = require("../../../shared/app-error");
exports.EvidencePolicy = {
    validateEvidenceOrigin: (evidence) => {
        if (evidence.sourceType === 'CODE' || evidence.sourceType === 'STATIC_ANALYSIS' || evidence.sourceType === 'COVERAGE' || evidence.sourceType === 'TEST') {
            if (!evidence.snapshotId) {
                throw new app_error_1.AppError('INVALID_EVIDENCE_ORIGIN', 'Code-related evidence must link to a snapshotId.');
            }
        }
        if (evidence.sourceType === 'REQUIREMENT_INPUT') {
            if (!evidence.requirementRevisionId) {
                throw new app_error_1.AppError('INVALID_EVIDENCE_ORIGIN', 'Requirement-related evidence must link to a requirementRevisionId.');
            }
        }
    },
    redactSecrets: (excerpt) => {
        const secretRegex = /(?:api[_-]?key|password|secret|token|credentials)[\s:=]+["'][a-zA-Z0-9_\-\.]+["']/gi;
        let hasSecrets = false;
        const redactedExcerpt = excerpt.replace(secretRegex, (match) => {
            hasSecrets = true;
            return match.replace(/["'][a-zA-Z0-9_\-\.]+["']/, '"[REDACTED]"');
        });
        return { redactedExcerpt, hasSecrets };
    },
};
