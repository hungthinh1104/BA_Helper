import { z } from 'zod';

export const repositoryCreateRequestSchema = z.object({
	url: z.string().url(),
});

export const repositoryCreateResponseSchema = z.object({
	repositoryId: z.string().uuid(),
	projectId: z.string().uuid(),
	canonicalUrl: z.string().url(),
	createdAt: z.string(),
});

export type RepositoryCreateRequest = z.infer<typeof repositoryCreateRequestSchema>;
export type RepositoryCreateResponse = z.infer<typeof repositoryCreateResponseSchema>;
