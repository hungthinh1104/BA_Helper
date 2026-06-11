import { z } from 'zod';
export declare const impactAnalysisCreateRequestSchema: z.ZodObject<{
    snapshotId: z.ZodString;
    sourceTargetId: z.ZodString;
    allowPartialSnapshot: z.ZodDefault<z.ZodBoolean>;
    requestKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    snapshotId: string;
    sourceTargetId: string;
    allowPartialSnapshot: boolean;
    requestKey: string;
}, {
    snapshotId: string;
    sourceTargetId: string;
    requestKey: string;
    allowPartialSnapshot?: boolean | undefined;
}>;
export declare const impactAnalysisStatusSchema: z.ZodEnum<["QUEUED", "RUNNING", "WAITING_FOR_REVIEW", "COMPLETED", "FAILED", "CANCELLED"]>;
export declare const impactAnalysisStageSchema: z.ZodEnum<["WAITING", "RETRIEVING_EVIDENCE", "EXPANDING_GRAPH", "RUNNING_AI_REASONING", "GENERATING_INSIGHTS", "GENERATING_DOCUMENTS", "DONE"]>;
export declare const impactAnalysisResponseSchema: z.ZodObject<{
    id: z.ZodString;
    sourceTarget: z.ZodObject<{
        id: z.ZodString;
        requestedRef: z.ZodString;
        resolvedRefType: z.ZodEnum<["BRANCH", "TAG", "COMMIT"]>;
        latestObservedCommitSha: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        requestedRef: string;
        resolvedRefType: "BRANCH" | "TAG" | "COMMIT";
        latestObservedCommitSha: string;
    }, {
        id: string;
        requestedRef: string;
        resolvedRefType: "BRANCH" | "TAG" | "COMMIT";
        latestObservedCommitSha: string;
    }>;
    snapshot: z.ZodObject<{
        id: z.ZodString;
        repositoryId: z.ZodString;
        commitSha: z.ZodString;
        analyzerVersion: z.ZodString;
        coverageStatus: z.ZodEnum<["READY", "PARTIAL"]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        commitSha: string;
        repositoryId: string;
        analyzerVersion: string;
        coverageStatus: "READY" | "PARTIAL";
    }, {
        id: string;
        commitSha: string;
        repositoryId: string;
        analyzerVersion: string;
        coverageStatus: "READY" | "PARTIAL";
    }>;
    freshness: z.ZodObject<{
        isStale: z.ZodBoolean;
        isAnalyzerOutdated: z.ZodBoolean;
        basis: z.ZodEnum<["LATEST_OBSERVED_SOURCE_TARGET", "PINNED_COMMIT"]>;
    }, "strip", z.ZodTypeAny, {
        isStale: boolean;
        isAnalyzerOutdated: boolean;
        basis: "LATEST_OBSERVED_SOURCE_TARGET" | "PINNED_COMMIT";
    }, {
        isStale: boolean;
        isAnalyzerOutdated: boolean;
        basis: "LATEST_OBSERVED_SOURCE_TARGET" | "PINNED_COMMIT";
    }>;
    requirement: z.ZodObject<{
        id: z.ZodString;
        revisionId: z.ZodString;
        revisionTitle: z.ZodString;
        rawText: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        revisionId: string;
        revisionTitle: string;
        rawText: string;
    }, {
        id: string;
        revisionId: string;
        revisionTitle: string;
        rawText: string;
    }>;
    status: z.ZodEnum<["QUEUED", "RUNNING", "WAITING_FOR_REVIEW", "COMPLETED", "FAILED", "CANCELLED"]>;
    stage: z.ZodEnum<["WAITING", "RETRIEVING_EVIDENCE", "EXPANDING_GRAPH", "RUNNING_AI_REASONING", "GENERATING_INSIGHTS", "GENERATING_DOCUMENTS", "DONE"]>;
    progress: z.ZodNumber;
    coverageWarning: z.ZodNullable<z.ZodString>;
    capabilities: z.ZodObject<{
        canReview: z.ZodBoolean;
        canFinalize: z.ZodBoolean;
        canExport: z.ZodBoolean;
        canRerun: z.ZodBoolean;
        canCancel: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        canReview: boolean;
        canFinalize: boolean;
        canExport: boolean;
        canRerun: boolean;
        canCancel: boolean;
    }, {
        canReview: boolean;
        canFinalize: boolean;
        canExport: boolean;
        canRerun: boolean;
        canCancel: boolean;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "QUEUED" | "RUNNING" | "WAITING_FOR_REVIEW" | "COMPLETED" | "FAILED" | "CANCELLED";
    sourceTarget: {
        id: string;
        requestedRef: string;
        resolvedRefType: "BRANCH" | "TAG" | "COMMIT";
        latestObservedCommitSha: string;
    };
    snapshot: {
        id: string;
        commitSha: string;
        repositoryId: string;
        analyzerVersion: string;
        coverageStatus: "READY" | "PARTIAL";
    };
    freshness: {
        isStale: boolean;
        isAnalyzerOutdated: boolean;
        basis: "LATEST_OBSERVED_SOURCE_TARGET" | "PINNED_COMMIT";
    };
    requirement: {
        id: string;
        revisionId: string;
        revisionTitle: string;
        rawText: string;
    };
    stage: "WAITING" | "RETRIEVING_EVIDENCE" | "EXPANDING_GRAPH" | "RUNNING_AI_REASONING" | "GENERATING_INSIGHTS" | "GENERATING_DOCUMENTS" | "DONE";
    progress: number;
    coverageWarning: string | null;
    capabilities: {
        canReview: boolean;
        canFinalize: boolean;
        canExport: boolean;
        canRerun: boolean;
        canCancel: boolean;
    };
}, {
    id: string;
    status: "QUEUED" | "RUNNING" | "WAITING_FOR_REVIEW" | "COMPLETED" | "FAILED" | "CANCELLED";
    sourceTarget: {
        id: string;
        requestedRef: string;
        resolvedRefType: "BRANCH" | "TAG" | "COMMIT";
        latestObservedCommitSha: string;
    };
    snapshot: {
        id: string;
        commitSha: string;
        repositoryId: string;
        analyzerVersion: string;
        coverageStatus: "READY" | "PARTIAL";
    };
    freshness: {
        isStale: boolean;
        isAnalyzerOutdated: boolean;
        basis: "LATEST_OBSERVED_SOURCE_TARGET" | "PINNED_COMMIT";
    };
    requirement: {
        id: string;
        revisionId: string;
        revisionTitle: string;
        rawText: string;
    };
    stage: "WAITING" | "RETRIEVING_EVIDENCE" | "EXPANDING_GRAPH" | "RUNNING_AI_REASONING" | "GENERATING_INSIGHTS" | "GENERATING_DOCUMENTS" | "DONE";
    progress: number;
    coverageWarning: string | null;
    capabilities: {
        canReview: boolean;
        canFinalize: boolean;
        canExport: boolean;
        canRerun: boolean;
        canCancel: boolean;
    };
}>;
export type ImpactAnalysisCreateRequest = z.infer<typeof impactAnalysisCreateRequestSchema>;
export type ImpactAnalysisResponse = z.infer<typeof impactAnalysisResponseSchema>;
