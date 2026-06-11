"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirementRevisionQualifyResponseSchema = exports.requirementRevisionCreateResponseSchema = exports.requirementRevisionCreateRequestSchema = exports.requirementCreateResponseSchema = exports.requirementCreateRequestSchema = void 0;
const zod_1 = require("zod");
exports.requirementCreateRequestSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).max(200),
    rawText: zod_1.z.string().trim().min(1).max(5000),
    submitForReadinessCheck: zod_1.z.boolean().default(true),
});
exports.requirementCreateResponseSchema = zod_1.z.object({
    requirementId: zod_1.z.string().uuid(),
    revisionId: zod_1.z.string().uuid(),
    title: zod_1.z.string(),
    readinessStatus: zod_1.z.enum([
        'DRAFT',
        'READY_FOR_ANALYSIS',
        'NEEDS_CLARIFICATION',
        'ARCHIVED',
    ]),
    validationIssues: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.requirementRevisionCreateRequestSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).max(200),
    rawText: zod_1.z.string().trim().min(1).max(5000),
    submitForReadinessCheck: zod_1.z.boolean().default(true),
});
exports.requirementRevisionCreateResponseSchema = exports.requirementCreateResponseSchema;
exports.requirementRevisionQualifyResponseSchema = zod_1.z.object({
    revisionId: zod_1.z.string().uuid(),
    readinessStatus: zod_1.z.enum([
        'DRAFT',
        'READY_FOR_ANALYSIS',
        'NEEDS_CLARIFICATION',
        'ARCHIVED',
    ]),
    validationIssues: zod_1.z.array(zod_1.z.string()).default([]),
});
