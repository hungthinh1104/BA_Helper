"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.traceabilityLinkListResponseSchema = exports.traceabilityLinkSchema = exports.traceabilityReviewRequestSchema = void 0;
const zod_1 = require("zod");
exports.traceabilityReviewRequestSchema = zod_1.z.object({
    reviewStatus: zod_1.z.enum(['CONFIRMED', 'REJECTED']),
});
exports.traceabilityLinkSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    artifactId: zod_1.z.string().uuid(),
    linkType: zod_1.z.enum(['AFFECTED', 'RELATED']),
    linkBasis: zod_1.z.enum(['EVIDENCED', 'INFERRED']),
    reviewStatus: zod_1.z.enum(['NEEDS_REVIEW', 'CONFIRMED', 'REJECTED']),
    confidence: zod_1.z.number().min(0).max(1).nullable(),
    evidence: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().uuid(),
        sourceType: zod_1.z.enum([
            'CODE',
            'TEST',
            'STATIC_ANALYSIS',
            'REQUIREMENT_INPUT',
            'COVERAGE',
            'HUMAN_NOTE',
        ]),
        filePath: zod_1.z.string().nullable(),
        startLine: zod_1.z.number().nullable(),
        endLine: zod_1.z.number().nullable(),
        excerpt: zod_1.z.string(),
    })),
});
exports.traceabilityLinkListResponseSchema = zod_1.z.object({
    items: zod_1.z.array(exports.traceabilityLinkSchema),
});
