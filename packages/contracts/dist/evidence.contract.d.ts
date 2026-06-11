import { z } from 'zod';
export declare const evidenceSchema: z.ZodObject<{
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
}>;
export declare const evidenceListResponseSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
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
    items: {
        id: string;
        filePath: string | null;
        startLine: number | null;
        endLine: number | null;
        sourceType: "CODE" | "TEST" | "STATIC_ANALYSIS" | "REQUIREMENT_INPUT" | "COVERAGE" | "HUMAN_NOTE";
        excerpt: string;
    }[];
}, {
    items: {
        id: string;
        filePath: string | null;
        startLine: number | null;
        endLine: number | null;
        sourceType: "CODE" | "TEST" | "STATIC_ANALYSIS" | "REQUIREMENT_INPUT" | "COVERAGE" | "HUMAN_NOTE";
        excerpt: string;
    }[];
}>;
export type EvidenceListResponse = z.infer<typeof evidenceListResponseSchema>;
