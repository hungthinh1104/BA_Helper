"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TraceabilityPolicy = void 0;
exports.TraceabilityPolicy = {
    validateLinkDirection: (params) => {
        if (params.sourceId === params.targetId) {
            throw new Error('Self-linking is not allowed.');
        }
        // E.g., a REQUIRES link typically goes from requirement to artifact.
        // E.g., an IMPLEMENTS link goes from artifact to requirement.
        // For now, we just validate it's not a self-link.
        return { valid: true };
    },
};
