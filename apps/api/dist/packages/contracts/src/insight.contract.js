"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insightListResponseSchema = exports.insightSchema = exports.insightReviewRequestSchema = void 0;
const zod_1 = require("zod");
exports.insightReviewRequestSchema = zod_1.z.object({
    reviewStatus: zod_1.z.enum(['CONFIRMED', 'REJECTED']),
});
exports.insightSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    category: zod_1.z.enum([
        'CLAIM',
        'UNKNOWN',
        'QUESTION',
        'ACCEPTANCE_CRITERIA',
        'QA_SCENARIO',
    ]),
    statement: zod_1.z.string(),
    certainty: zod_1.z.enum(['EVIDENCED', 'INFERRED', 'UNKNOWN', 'CONFLICTING']),
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
exports.insightListResponseSchema = zod_1.z.object({
    items: zod_1.z.array(exports.insightSchema),
});
