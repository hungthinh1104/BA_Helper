"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.finalizeImpactAnalysisRequestSchema = exports.documentListResponseSchema = exports.documentSchema = void 0;
const zod_1 = require("zod");
exports.documentSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    type: zod_1.z.enum(['IMPACT_REPORT']),
    status: zod_1.z.enum(['DRAFT', 'APPROVED']),
    commitSha: zod_1.z.string(),
    isStale: zod_1.z.boolean(),
});
exports.documentListResponseSchema = zod_1.z.object({
    items: zod_1.z.array(exports.documentSchema),
});
exports.finalizeImpactAnalysisRequestSchema = zod_1.z.object({
    acknowledgeUnreviewed: zod_1.z.boolean().default(false),
});
