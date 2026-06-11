import { z, type TypeOf as ZodTypeOf } from 'zod';
export declare const artifactSchema: z.ZodObject<{
    id: z.ZodString;
    artifactKey: z.ZodString;
    name: z.ZodString;
    artifactType: z.ZodString;
    filePath: z.ZodString;
    startLine: z.ZodNullable<z.ZodNumber>;
    endLine: z.ZodNullable<z.ZodNumber>;
    language: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    artifactKey: string;
    name: string;
    artifactType: string;
    filePath: string;
    startLine: number | null;
    endLine: number | null;
    language: string | null;
}, {
    id: string;
    artifactKey: string;
    name: string;
    artifactType: string;
    filePath: string;
    startLine: number | null;
    endLine: number | null;
    language: string | null;
}>;
export declare const artifactListResponseSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        artifactKey: z.ZodString;
        name: z.ZodString;
        artifactType: z.ZodString;
        filePath: z.ZodString;
        startLine: z.ZodNullable<z.ZodNumber>;
        endLine: z.ZodNullable<z.ZodNumber>;
        language: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        artifactKey: string;
        name: string;
        artifactType: string;
        filePath: string;
        startLine: number | null;
        endLine: number | null;
        language: string | null;
    }, {
        id: string;
        artifactKey: string;
        name: string;
        artifactType: string;
        filePath: string;
        startLine: number | null;
        endLine: number | null;
        language: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        artifactKey: string;
        name: string;
        artifactType: string;
        filePath: string;
        startLine: number | null;
        endLine: number | null;
        language: string | null;
    }[];
}, {
    items: {
        id: string;
        artifactKey: string;
        name: string;
        artifactType: string;
        filePath: string;
        startLine: number | null;
        endLine: number | null;
        language: string | null;
    }[];
}>;
export type ArtifactListResponse = ZodTypeOf<typeof artifactListResponseSchema>;
