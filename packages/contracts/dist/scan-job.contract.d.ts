import { z } from 'zod';
export declare const scanJobCreateRequestSchema: z.ZodObject<{
    ref: z.ZodOptional<z.ZodString>;
    requestKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    requestKey: string;
    ref?: string | undefined;
}, {
    requestKey: string;
    ref?: string | undefined;
}>;
export declare const scanJobStatusSchema: z.ZodEnum<["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]>;
export declare const scanJobStageSchema: z.ZodEnum<["WAITING", "CLONING_REPO", "RESOLVING_SOURCE_REF", "DETECTING_PROJECT", "FILTERING_FILES", "EXTRACTING_ARTIFACTS", "BUILDING_GRAPH", "GENERATING_SUMMARIES", "DONE"]>;
export declare const scanJobResponseSchema: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]>;
    stage: z.ZodEnum<["WAITING", "CLONING_REPO", "RESOLVING_SOURCE_REF", "DETECTING_PROJECT", "FILTERING_FILES", "EXTRACTING_ARTIFACTS", "BUILDING_GRAPH", "GENERATING_SUMMARIES", "DONE"]>;
    progress: z.ZodNumber;
    error: z.ZodNullable<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
    }, {
        code: string;
        message: string;
    }>>;
    result: z.ZodObject<{
        sourceTargetId: z.ZodNullable<z.ZodString>;
        snapshotId: z.ZodNullable<z.ZodString>;
        snapshotCoverageStatus: z.ZodNullable<z.ZodEnum<["READY", "PARTIAL"]>>;
    }, "strip", z.ZodTypeAny, {
        snapshotId: string | null;
        sourceTargetId: string | null;
        snapshotCoverageStatus: "READY" | "PARTIAL" | null;
    }, {
        snapshotId: string | null;
        sourceTargetId: string | null;
        snapshotCoverageStatus: "READY" | "PARTIAL" | null;
    }>;
    capabilities: z.ZodObject<{
        canCancel: z.ZodBoolean;
        canRerun: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        canRerun: boolean;
        canCancel: boolean;
    }, {
        canRerun: boolean;
        canCancel: boolean;
    }>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
    stage: "WAITING" | "DONE" | "CLONING_REPO" | "RESOLVING_SOURCE_REF" | "DETECTING_PROJECT" | "FILTERING_FILES" | "EXTRACTING_ARTIFACTS" | "BUILDING_GRAPH" | "GENERATING_SUMMARIES";
    progress: number;
    capabilities: {
        canRerun: boolean;
        canCancel: boolean;
    };
    createdAt: string;
    error: {
        code: string;
        message: string;
    } | null;
    result: {
        snapshotId: string | null;
        sourceTargetId: string | null;
        snapshotCoverageStatus: "READY" | "PARTIAL" | null;
    };
    updatedAt: string;
}, {
    id: string;
    status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
    stage: "WAITING" | "DONE" | "CLONING_REPO" | "RESOLVING_SOURCE_REF" | "DETECTING_PROJECT" | "FILTERING_FILES" | "EXTRACTING_ARTIFACTS" | "BUILDING_GRAPH" | "GENERATING_SUMMARIES";
    progress: number;
    capabilities: {
        canRerun: boolean;
        canCancel: boolean;
    };
    createdAt: string;
    error: {
        code: string;
        message: string;
    } | null;
    result: {
        snapshotId: string | null;
        sourceTargetId: string | null;
        snapshotCoverageStatus: "READY" | "PARTIAL" | null;
    };
    updatedAt: string;
}>;
export type ScanJobCreateRequest = z.infer<typeof scanJobCreateRequestSchema>;
export type ScanJobResponse = z.infer<typeof scanJobResponseSchema>;
