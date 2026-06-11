import { z } from 'zod';
export declare const traceabilityReviewRequestSchema: z.ZodObject<{
    reviewStatus: z.ZodEnum<["CONFIRMED", "REJECTED"]>;
}, "strip", z.ZodTypeAny, {
    reviewStatus: "CONFIRMED" | "REJECTED";
}, {
    reviewStatus: "CONFIRMED" | "REJECTED";
}>;
export declare const traceabilityLinkSchema: z.ZodObject<{
    id: z.ZodString;
    artifactId: z.ZodString;
    linkType: z.ZodEnum<["AFFECTED", "RELATED"]>;
    linkBasis: z.ZodEnum<["EVIDENCED", "INFERRED"]>;
    reviewStatus: z.ZodEnum<["NEEDS_REVIEW", "CONFIRMED", "REJECTED"]>;
    confidence: z.ZodNullable<z.ZodNumber>;
    evidence: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        sourceType: z.ZodEnum<["CODE", "TEST", "STATIC_ANALYSIS", "REQUIREMENT_INPUT", "COVERAGE", "HUMAN_NOTE"]>;
        filePath: z.ZodNullable<z.ZodString>;
        startLine: z.ZodNullable<z.ZodNumber>;
        endLine: z.ZodNullable<z.ZodNumber>;
        excerpt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        filePath: string | null;
        startLine: number | null;
        endLine: number | null;
        sourceType: "CODE" | "TEST" | "STATIC_ANALYSIS" | "REQUIREMENT_INPUT" | "COVERAGE" | "HUMAN_NOTE";
        excerpt: string;
    }, {
        id: string;
        filePath: string | null;
        startLine: number | null;
        endLine: number | null;
        sourceType: "CODE" | "TEST" | "STATIC_ANALYSIS" | "REQUIREMENT_INPUT" | "COVERAGE" | "HUMAN_NOTE";
        excerpt: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    reviewStatus: "CONFIRMED" | "REJECTED" | "NEEDS_REVIEW";
    confidence: number | null;
    evidence: {
        id: string;
        filePath: string | null;
        startLine: number | null;
        endLine: number | null;
        sourceType: "CODE" | "TEST" | "STATIC_ANALYSIS" | "REQUIREMENT_INPUT" | "COVERAGE" | "HUMAN_NOTE";
        excerpt: string;
    }[];
    artifactId: string;
    linkType: "AFFECTED" | "RELATED";
    linkBasis: "EVIDENCED" | "INFERRED";
}, {
    id: string;
    reviewStatus: "CONFIRMED" | "REJECTED" | "NEEDS_REVIEW";
    confidence: number | null;
    evidence: {
        id: string;
        filePath: string | null;
        startLine: number | null;
        endLine: number | null;
        sourceType: "CODE" | "TEST" | "STATIC_ANALYSIS" | "REQUIREMENT_INPUT" | "COVERAGE" | "HUMAN_NOTE";
        excerpt: string;
    }[];
    artifactId: string;
    linkType: "AFFECTED" | "RELATED";
    linkBasis: "EVIDENCED" | "INFERRED";
}>;
export declare const traceabilityLinkListResponseSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        artifactId: z.ZodString;
        linkType: z.ZodEnum<["AFFECTED", "RELATED"]>;
        linkBasis: z.ZodEnum<["EVIDENCED", "INFERRED"]>;
        reviewStatus: z.ZodEnum<["NEEDS_REVIEW", "CONFIRMED", "REJECTED"]>;
        confidence: z.ZodNullable<z.ZodNumber>;
        evidence: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            sourceType: z.ZodEnum<["CODE", "TEST", "STATIC_ANALYSIS", "REQUIREMENT_INPUT", "COVERAGE", "HUMAN_NOTE"]>;
            filePath: z.ZodNullable<z.ZodString>;
            startLine: z.ZodNullable<z.ZodNumber>;
            endLine: z.ZodNullable<z.ZodNumber>;
            excerpt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            filePath: string | null;
            startLine: number | null;
            endLine: number | null;
            sourceType: "CODE" | "TEST" | "STATIC_ANALYSIS" | "REQUIREMENT_INPUT" | "COVERAGE" | "HUMAN_NOTE";
            excerpt: string;
        }, {
            id: string;
            filePath: string | null;
            startLine: number | null;
            endLine: number | null;
            sourceType: "CODE" | "TEST" | "STATIC_ANALYSIS" | "REQUIREMENT_INPUT" | "COVERAGE" | "HUMAN_NOTE";
            excerpt: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        reviewStatus: "CONFIRMED" | "REJECTED" | "NEEDS_REVIEW";
        confidence: number | null;
        evidence: {
            id: string;
            filePath: string | null;
            startLine: number | null;
            endLine: number | null;
            sourceType: "CODE" | "TEST" | "STATIC_ANALYSIS" | "REQUIREMENT_INPUT" | "COVERAGE" | "HUMAN_NOTE";
            excerpt: string;
        }[];
        artifactId: string;
        linkType: "AFFECTED" | "RELATED";
        linkBasis: "EVIDENCED" | "INFERRED";
    }, {
        id: string;
        reviewStatus: "CONFIRMED" | "REJECTED" | "NEEDS_REVIEW";
        confidence: number | null;
        evidence: {
            id: string;
            filePath: string | null;
            startLine: number | null;
            endLine: number | null;
            sourceType: "CODE" | "TEST" | "STATIC_ANALYSIS" | "REQUIREMENT_INPUT" | "COVERAGE" | "HUMAN_NOTE";
            excerpt: string;
        }[];
        artifactId: string;
        linkType: "AFFECTED" | "RELATED";
        linkBasis: "EVIDENCED" | "INFERRED";
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        reviewStatus: "CONFIRMED" | "REJECTED" | "NEEDS_REVIEW";
        confidence: number | null;
        evidence: {
            id: string;
            filePath: string | null;
            startLine: number | null;
            endLine: number | null;
            sourceType: "CODE" | "TEST" | "STATIC_ANALYSIS" | "REQUIREMENT_INPUT" | "COVERAGE" | "HUMAN_NOTE";
            excerpt: string;
        }[];
        artifactId: string;
        linkType: "AFFECTED" | "RELATED";
        linkBasis: "EVIDENCED" | "INFERRED";
    }[];
}, {
    items: {
        id: string;
        reviewStatus: "CONFIRMED" | "REJECTED" | "NEEDS_REVIEW";
        confidence: number | null;
        evidence: {
            id: string;
            filePath: string | null;
            startLine: number | null;
            endLine: number | null;
            sourceType: "CODE" | "TEST" | "STATIC_ANALYSIS" | "REQUIREMENT_INPUT" | "COVERAGE" | "HUMAN_NOTE";
            excerpt: string;
        }[];
        artifactId: string;
        linkType: "AFFECTED" | "RELATED";
        linkBasis: "EVIDENCED" | "INFERRED";
    }[];
}>;
export type TraceabilityLinkListResponse = z.infer<typeof traceabilityLinkListResponseSchema>;
export type TraceabilityReviewRequest = z.infer<typeof traceabilityReviewRequestSchema>;
