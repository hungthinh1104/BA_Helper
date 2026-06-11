"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanJobResponseSchema = exports.scanJobStageSchema = exports.scanJobStatusSchema = exports.scanJobCreateRequestSchema = void 0;
const zod_1 = require("zod");
exports.scanJobCreateRequestSchema = zod_1.z.object({
    ref: zod_1.z.string().min(1).optional(),
    requestKey: zod_1.z.string().uuid(),
});
exports.scanJobStatusSchema = zod_1.z.enum([
    'QUEUED',
    'RUNNING',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
]);
exports.scanJobStageSchema = zod_1.z.enum([
    'WAITING',
    'CLONING_REPO',
    'RESOLVING_SOURCE_REF',
    'DETECTING_PROJECT',
    'FILTERING_FILES',
    'EXTRACTING_ARTIFACTS',
    'BUILDING_GRAPH',
    'GENERATING_SUMMARIES',
    'DONE',
]);
exports.scanJobResponseSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    status: exports.scanJobStatusSchema,
    stage: exports.scanJobStageSchema,
    progress: zod_1.z.number().min(0).max(100),
    error: zod_1.z
        .object({
        code: zod_1.z.string(),
        message: zod_1.z.string(),
    })
        .nullable(),
    result: zod_1.z.object({
        sourceTargetId: zod_1.z.string().uuid().nullable(),
        snapshotId: zod_1.z.string().uuid().nullable(),
        snapshotCoverageStatus: zod_1.z.enum(['READY', 'PARTIAL']).nullable(),
    }),
    capabilities: zod_1.z.object({
        canCancel: zod_1.z.boolean(),
        canRerun: zod_1.z.boolean(),
    }),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
});
