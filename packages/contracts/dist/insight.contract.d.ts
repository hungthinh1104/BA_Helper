import { z } from 'zod';
export declare const insightReviewRequestSchema: z.ZodObject<{
    reviewStatus: z.ZodEnum<["CONFIRMED", "REJECTED"]>;
}, "strip", z.ZodTypeAny, {
    reviewStatus: "CONFIRMED" | "REJECTED";
}, {
    reviewStatus: "CONFIRMED" | "REJECTED";
}>;
export declare const insightSchema: z.ZodObject<{
    id: z.ZodString;
    category: z.ZodEnum<["CLAIM", "UNKNOWN", "QUESTION", "ACCEPTANCE_CRITERIA", "QA_SCENARIO"]>;
    statement: z.ZodString;
    certainty: z.ZodEnum<["EVIDENCED", "INFERRED", "UNKNOWN", "CONFLICTING"]>;
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
    category: "CLAIM" | "UNKNOWN" | "QUESTION" | "ACCEPTANCE_CRITERIA" | "QA_SCENARIO";
    statement: string;
    certainty: "UNKNOWN" | "EVIDENCED" | "INFERRED" | "CONFLICTING";
    confidence: number | null;
    evidence: {
        id: string;
        filePath: string | null;
        startLine: number | null;
        endLine: number | null;
        sourceType: "CODE" | "TEST" | "STATIC_ANALYSIS" | "REQUIREMENT_INPUT" | "COVERAGE" | "HUMAN_NOTE";
        excerpt: string;
    }[];
}, {
    id: string;
    reviewStatus: "CONFIRMED" | "REJECTED" | "NEEDS_REVIEW";
    category: "CLAIM" | "UNKNOWN" | "QUESTION" | "ACCEPTANCE_CRITERIA" | "QA_SCENARIO";
    statement: string;
    certainty: "UNKNOWN" | "EVIDENCED" | "INFERRED" | "CONFLICTING";
    confidence: number | null;
    evidence: {
        id: string;
        filePath: string | null;
        startLine: number | null;
        endLine: number | null;
        sourceType: "CODE" | "TEST" | "STATIC_ANALYSIS" | "REQUIREMENT_INPUT" | "COVERAGE" | "HUMAN_NOTE";
        excerpt: string;
    }[];
}>;
export declare const insightListResponseSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        category: z.ZodEnum<["CLAIM", "UNKNOWN", "QUESTION", "ACCEPTANCE_CRITERIA", "QA_SCENARIO"]>;
        statement: z.ZodString;
        certainty: z.ZodEnum<["EVIDENCED", "INFERRED", "UNKNOWN", "CONFLICTING"]>;
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
        category: "CLAIM" | "UNKNOWN" | "QUESTION" | "ACCEPTANCE_CRITERIA" | "QA_SCENARIO";
        statement: string;
        certainty: "UNKNOWN" | "EVIDENCED" | "INFERRED" | "CONFLICTING";
        confidence: number | null;
        evidence: {
            id: string;
            filePath: string | null;
            startLine: number | null;
            endLine: number | null;
            sourceType: "CODE" | "TEST" | "STATIC_ANALYSIS" | "REQUIREMENT_INPUT" | "COVERAGE" | "HUMAN_NOTE";
            excerpt: string;
        }[];
    }, {
        id: string;
        reviewStatus: "CONFIRMED" | "REJECTED" | "NEEDS_REVIEW";
        category: "CLAIM" | "UNKNOWN" | "QUESTION" | "ACCEPTANCE_CRITERIA" | "QA_SCENARIO";
        statement: string;
        certainty: "UNKNOWN" | "EVIDENCED" | "INFERRED" | "CONFLICTING";
        confidence: number | null;
        evidence: {
            id: string;
            filePath: string | null;
            startLine: number | null;
            endLine: number | null;
            sourceType: "CODE" | "TEST" | "STATIC_ANALYSIS" | "REQUIREMENT_INPUT" | "COVERAGE" | "HUMAN_NOTE";
            excerpt: string;
        }[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        reviewStatus: "CONFIRMED" | "REJECTED" | "NEEDS_REVIEW";
        category: "CLAIM" | "UNKNOWN" | "QUESTION" | "ACCEPTANCE_CRITERIA" | "QA_SCENARIO";
        statement: string;
        certainty: "UNKNOWN" | "EVIDENCED" | "INFERRED" | "CONFLICTING";
        confidence: number | null;
        evidence: {
            id: string;
            filePath: string | null;
            startLine: number | null;
            endLine: number | null;
            sourceType: "CODE" | "TEST" | "STATIC_ANALYSIS" | "REQUIREMENT_INPUT" | "COVERAGE" | "HUMAN_NOTE";
            excerpt: string;
        }[];
    }[];
}, {
    items: {
        id: string;
        reviewStatus: "CONFIRMED" | "REJECTED" | "NEEDS_REVIEW";
        category: "CLAIM" | "UNKNOWN" | "QUESTION" | "ACCEPTANCE_CRITERIA" | "QA_SCENARIO";
        statement: string;
        certainty: "UNKNOWN" | "EVIDENCED" | "INFERRED" | "CONFLICTING";
        confidence: number | null;
        evidence: {
            id: string;
            filePath: string | null;
            startLine: number | null;
            endLine: number | null;
            sourceType: "CODE" | "TEST" | "STATIC_ANALYSIS" | "REQUIREMENT_INPUT" | "COVERAGE" | "HUMAN_NOTE";
            excerpt: string;
        }[];
    }[];
}>;
export type InsightListResponse = z.infer<typeof insightListResponseSchema>;
export type InsightReviewRequest = z.infer<typeof insightReviewRequestSchema>;
