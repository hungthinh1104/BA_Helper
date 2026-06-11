import { z } from 'zod';
import { scanJobStatusSchema, scanJobStageSchema } from './scan-job.contract';

export const repositoryCreateRequestSchema = z.object({
	url: z.string().url(),
});

export const repositoryCreateResponseSchema = z.object({
	repositoryId: z.string().uuid(),
	projectId: z.string().uuid(),
	canonicalUrl: z.string().url(),
	createdAt: z.string(),
});

export const repositoryListItemResponseSchema = z.object({
	id: z.string().uuid(),
	canonicalUrl: z.string().url(),
	displayName: z.string(),
	framework: z.string().optional(),
	latestTarget: z.object({
		requestedRef: z.string(),
		resolvedCommitSha: z.string().optional(),
	}).optional(),
	latestScanJob: z.object({
		id: z.string().uuid(),
		status: scanJobStatusSchema,
		stage: scanJobStageSchema,
		progress: z.number().min(0).max(100),
		canCancel: z.boolean(),
	}).optional(),
	latestSnapshot: z.object({
		id: z.string().uuid(),
		commitSha: z.string(),
		analyzerVersion: z.string(),
		coverageStatus: z.enum(['READY', 'PARTIAL']),
		indexStatus: z.string(),
	}).optional(),
});

export const repositoryListResponseSchema = z.object({
	items: z.array(repositoryListItemResponseSchema),
});

export const repositoryDetailResponseSchema = repositoryListItemResponseSchema.extend({
	artifactStats: z.object({
		controllers: z.number().int().min(0),
		services: z.number().int().min(0),
		entities: z.number().int().min(0),
		tests: z.number().int().min(0),
	}),
});

export type RepositoryCreateRequest = z.infer<typeof repositoryCreateRequestSchema>;
export type RepositoryCreateResponse = z.infer<typeof repositoryCreateResponseSchema>;
export type RepositoryListItemResponse = z.infer<typeof repositoryListItemResponseSchema>;
export type RepositoryListResponse = z.infer<typeof repositoryListResponseSchema>;
export type RepositoryDetailResponse = z.infer<typeof repositoryDetailResponseSchema>;
