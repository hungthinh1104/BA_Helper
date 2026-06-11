import { z } from 'zod';
export declare const documentSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<["IMPACT_REPORT"]>;
    status: z.ZodEnum<["DRAFT", "APPROVED"]>;
    commitSha: z.ZodString;
    isStale: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: "IMPACT_REPORT";
    status: "DRAFT" | "APPROVED";
    commitSha: string;
    isStale: boolean;
}, {
    id: string;
    type: "IMPACT_REPORT";
    status: "DRAFT" | "APPROVED";
    commitSha: string;
    isStale: boolean;
}>;
export declare const documentListResponseSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<["IMPACT_REPORT"]>;
        status: z.ZodEnum<["DRAFT", "APPROVED"]>;
        commitSha: z.ZodString;
        isStale: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: "IMPACT_REPORT";
        status: "DRAFT" | "APPROVED";
        commitSha: string;
        isStale: boolean;
    }, {
        id: string;
        type: "IMPACT_REPORT";
        status: "DRAFT" | "APPROVED";
        commitSha: string;
        isStale: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        type: "IMPACT_REPORT";
        status: "DRAFT" | "APPROVED";
        commitSha: string;
        isStale: boolean;
    }[];
}, {
    items: {
        id: string;
        type: "IMPACT_REPORT";
        status: "DRAFT" | "APPROVED";
        commitSha: string;
        isStale: boolean;
    }[];
}>;
export declare const finalizeImpactAnalysisRequestSchema: z.ZodObject<{
    acknowledgeUnreviewed: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    acknowledgeUnreviewed: boolean;
}, {
    acknowledgeUnreviewed?: boolean | undefined;
}>;
export type DocumentListResponse = z.infer<typeof documentListResponseSchema>;
export type FinalizeImpactAnalysisRequest = z.infer<typeof finalizeImpactAnalysisRequestSchema>;
