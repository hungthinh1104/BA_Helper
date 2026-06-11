"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentPolicy = void 0;
exports.DocumentPolicy = {
    canGenerate: (analysisStatus, coverageWarning) => {
        if (analysisStatus !== 'COMPLETED') {
            return {
                allowed: false,
                reason: 'Document can only be generated for a completed analysis.',
            };
        }
        if (coverageWarning) {
            return {
                allowed: true,
                warning: 'Analysis has coverage warnings. Document might be incomplete.',
            };
        }
        return { allowed: true };
    },
};
