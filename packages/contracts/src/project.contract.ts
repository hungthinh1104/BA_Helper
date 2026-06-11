import { z } from 'zod';

export const projectCreateRequestSchema = z.object({
	name: z.string().trim().min(1).max(200),
});

export const projectCreateResponseSchema = z.object({
	projectId: z.string().uuid(),
	name: z.string(),
	createdAt: z.string(),
});

export type ProjectCreateRequest = z.infer<typeof projectCreateRequestSchema>;
export type ProjectCreateResponse = z.infer<typeof projectCreateResponseSchema>;
