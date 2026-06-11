import { z } from 'zod';
export declare const repositoryCreateRequestSchema: z.ZodObject<{
    url: z.ZodString;
}, "strip", z.ZodTypeAny, {
    url: string;
}, {
    url: string;
}>;
export declare const repositoryCreateResponseSchema: z.ZodObject<{
    repositoryId: z.ZodString;
    projectId: z.ZodString;
    canonicalUrl: z.ZodString;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    repositoryId: string;
    projectId: string;
    createdAt: string;
    canonicalUrl: string;
}, {
    repositoryId: string;
    projectId: string;
    createdAt: string;
    canonicalUrl: string;
}>;
export type RepositoryCreateRequest = z.infer<typeof repositoryCreateRequestSchema>;
export type RepositoryCreateResponse = z.infer<typeof repositoryCreateResponseSchema>;
