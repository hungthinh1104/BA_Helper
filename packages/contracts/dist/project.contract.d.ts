import { z } from 'zod';
export declare const projectCreateRequestSchema: z.ZodObject<{
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
}, {
    name: string;
}>;
export declare const projectCreateResponseSchema: z.ZodObject<{
    projectId: z.ZodString;
    name: z.ZodString;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    projectId: string;
    createdAt: string;
}, {
    name: string;
    projectId: string;
    createdAt: string;
}>;
export type ProjectCreateRequest = z.infer<typeof projectCreateRequestSchema>;
export type ProjectCreateResponse = z.infer<typeof projectCreateResponseSchema>;
