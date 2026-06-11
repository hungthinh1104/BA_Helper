"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.impactAnalysisResponseSchema = exports.impactAnalysisStageSchema = exports.impactAnalysisStatusSchema = exports.impactAnalysisCreateRequestSchema = void 0;
const zod_1 = require("zod");
exports.impactAnalysisCreateRequestSchema = zod_1.z.object({
    snapshotId: zod_1.z.string().uuid(),
    sourceTargetId: zod_1.z.string().uuid(),
    allowPartialSnapshot: zod_1.z.boolean().default(false),
    requestKey: zod_1.z.string().uuid(),
});
exports.impactAnalysisStatusSchema = zod_1.z.enum([
    'QUEUED',
    'RUNNING',
    'WAITING_FOR_REVIEW',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
]);
exports.impactAnalysisStageSchema = zod_1.z.enum([
    'WAITING',
    'RETRIEVING_EVIDENCE',
    'EXPANDING_GRAPH',
    'RUNNING_AI_REASONING',
    'GENERATING_INSIGHTS',
    'GENERATING_DOCUMENTS',
    'DONE',
]);
exports.impactAnalysisResponseSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    sourceTarget: zod_1.z.object({
        id: zod_1.z.string().uuid(),
        requestedRef: zod_1.z.string(),
        resolvedRefType: zod_1.z.enum(['BRANCH', 'TAG', 'COMMIT']),
        latestObservedCommitSha: zod_1.z.string(),
    }),
    snapshot: zod_1.z.object({
        id: zod_1.z.string().uuid(),
        repositoryId: zod_1.z.string().uuid(),
        commitSha: zod_1.z.string(),
        analyzerVersion: zod_1.z.string(),
        coverageStatus: zod_1.z.enum(['READY', 'PARTIAL']),
    }),
    freshness: zod_1.z.object({
        isStale: zod_1.z.boolean(),
        isAnalyzerOutdated: zod_1.z.boolean(),
        basis: zod_1.z.enum(['LATEST_OBSERVED_SOURCE_TARGET', 'PINNED_COMMIT']),
    }),
    requirement: zod_1.z.object({
        id: zod_1.z.string().uuid(),
        revisionId: zod_1.z.string().uuid(),
        revisionTitle: zod_1.z.string(),
        rawText: zod_1.z.string(),
    }),
    status: exports.impactAnalysisStatusSchema,
    stage: exports.impactAnalysisStageSchema,
    progress: zod_1.z.number().min(0).max(100),
    coverageWarning: zod_1.z.string().nullable(),
    capabilities: zod_1.z.object({
        canReview: zod_1.z.boolean(),
        canFinalize: zod_1.z.boolean(),
        canExport: zod_1.z.boolean(),
        canRerun: zod_1.z.boolean(),
        canCancel: zod_1.z.boolean(),
    }),
});
