import { z } from 'zod';
export declare const requirementCreateRequestSchema: z.ZodObject<{
    title: z.ZodString;
    rawText: z.ZodString;
    submitForReadinessCheck: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    rawText: string;
    title: string;
    submitForReadinessCheck: boolean;
}, {
    rawText: string;
    title: string;
    submitForReadinessCheck?: boolean | undefined;
}>;
export declare const requirementCreateResponseSchema: z.ZodObject<{
    requirementId: z.ZodString;
    revisionId: z.ZodString;
    title: z.ZodString;
    readinessStatus: z.ZodEnum<["DRAFT", "READY_FOR_ANALYSIS", "NEEDS_CLARIFICATION", "ARCHIVED"]>;
    validationIssues: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    revisionId: string;
    title: string;
    requirementId: string;
    readinessStatus: "DRAFT" | "READY_FOR_ANALYSIS" | "NEEDS_CLARIFICATION" | "ARCHIVED";
    validationIssues: string[];
}, {
    revisionId: string;
    title: string;
    requirementId: string;
    readinessStatus: "DRAFT" | "READY_FOR_ANALYSIS" | "NEEDS_CLARIFICATION" | "ARCHIVED";
    validationIssues?: string[] | undefined;
}>;
export declare const requirementRevisionCreateRequestSchema: z.ZodObject<{
    title: z.ZodString;
    rawText: z.ZodString;
    submitForReadinessCheck: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    rawText: string;
    title: string;
    submitForReadinessCheck: boolean;
}, {
    rawText: string;
    title: string;
    submitForReadinessCheck?: boolean | undefined;
}>;
export declare const requirementRevisionCreateResponseSchema: z.ZodObject<{
    requirementId: z.ZodString;
    revisionId: z.ZodString;
    title: z.ZodString;
    readinessStatus: z.ZodEnum<["DRAFT", "READY_FOR_ANALYSIS", "NEEDS_CLARIFICATION", "ARCHIVED"]>;
    validationIssues: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    revisionId: string;
    title: string;
    requirementId: string;
    readinessStatus: "DRAFT" | "READY_FOR_ANALYSIS" | "NEEDS_CLARIFICATION" | "ARCHIVED";
    validationIssues: string[];
}, {
    revisionId: string;
    title: string;
    requirementId: string;
    readinessStatus: "DRAFT" | "READY_FOR_ANALYSIS" | "NEEDS_CLARIFICATION" | "ARCHIVED";
    validationIssues?: string[] | undefined;
}>;
export declare const requirementRevisionQualifyResponseSchema: z.ZodObject<{
    revisionId: z.ZodString;
    readinessStatus: z.ZodEnum<["DRAFT", "READY_FOR_ANALYSIS", "NEEDS_CLARIFICATION", "ARCHIVED"]>;
    validationIssues: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    revisionId: string;
    readinessStatus: "DRAFT" | "READY_FOR_ANALYSIS" | "NEEDS_CLARIFICATION" | "ARCHIVED";
    validationIssues: string[];
}, {
    revisionId: string;
    readinessStatus: "DRAFT" | "READY_FOR_ANALYSIS" | "NEEDS_CLARIFICATION" | "ARCHIVED";
    validationIssues?: string[] | undefined;
}>;
export type RequirementCreateRequest = z.infer<typeof requirementCreateRequestSchema>;
export type RequirementCreateResponse = z.infer<typeof requirementCreateResponseSchema>;
export type RequirementRevisionCreateRequest = z.infer<typeof requirementRevisionCreateRequestSchema>;
export type RequirementRevisionCreateResponse = z.infer<typeof requirementRevisionCreateResponseSchema>;
export type RequirementRevisionQualifyResponse = z.infer<typeof requirementRevisionQualifyResponseSchema>;
