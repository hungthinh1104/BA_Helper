"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiResponseSchema = exports.aiInsightSchema = void 0;
const zod_1 = require("zod");
exports.aiInsightSchema = zod_1.z.object({
    insightKey: zod_1.z.string().min(1),
    certainty: zod_1.z.enum(['EVIDENCED', 'INFERRED', 'UNKNOWN', 'CONFLICTING']),
    description: zod_1.z.string().min(1),
    evidenceIds: zod_1.z.array(zod_1.z.string().uuid()).default([]),
});
exports.aiResponseSchema = zod_1.z.object({
    insights: zod_1.z.array(exports.aiInsightSchema),
});
