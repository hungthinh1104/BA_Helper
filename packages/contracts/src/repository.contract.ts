import { z } from 'zod';
import { scanJobStatusSchema, scanJobStageSchema } from './scan-job.contract';
import { diagnosticItemSchema } from './diagnostic.contract';
import { errorCodeSchema } from './error.contract';

export const snapshotIndexStatusSchema = z.enum([
	'NOT_INDEXED',
	'LEXICAL_READY',
	'VECTOR_INDEXING',
	'VECTOR_READY',
	'VECTOR_FAILED',
]);
export type SnapshotIndexStatus = z.infer<typeof snapshotIndexStatusSchema>;

export const repositoryCreateRequestSchema = z.object({
	url: z.string().url(),
});

export const repositoryCreateResponseSchema = z.object({
	repositoryId: z.string().uuid(),
	projectId: z.string().uuid(),
	canonicalUrl: z.string().url(),
	createdAt: z.string(),
});

export const repositoryProfileDomainSchema = z.enum([
	'BOOKING',
	'PAYMENT',
	'REFUND',
	'NOTIFICATION',
	'INVENTORY',
	'CUSTOM',
	'UNKNOWN',
]);

export const repositoryProfileLanguageSchema = z.enum([
	'TYPESCRIPT',
	'UNKNOWN',
]);

export const repositoryProfileFrameworkSchema = z.enum([
	'NESTJS',
	'GENERIC_TYPESCRIPT',
	'UNKNOWN',
]);

export const repositoryProfileArchitectureStyleSchema = z.enum([
	'MODULAR_MONOLITH',
	'LAYERED',
	'UNKNOWN',
]);

export const repositoryProfileDiagnosticSchema = z.object({
	detectedMarkers: z.array(z.string()).max(20).optional(),
	confidence: z.number().min(0).max(1).optional(),
	unsupportedReason: z.string().optional(),
});

export const repositoryProfileResponseSchema = z.object({
	domain: repositoryProfileDomainSchema,
	language: repositoryProfileLanguageSchema,
	framework: repositoryProfileFrameworkSchema,
	architectureStyle: repositoryProfileArchitectureStyleSchema,
	sourceRoots: z.array(z.string()).max(20),
	testRoots: z.array(z.string()).max(20),
	diagnostics: repositoryProfileDiagnosticSchema.optional(),
	profileVersion: z.string(),
});

export const repositoryListItemResponseSchema = z.object({
	id: z.string().uuid(),
	canonicalUrl: z.string().url(),
	displayName: z.string(),
	framework: z.string().optional(),
	latestTarget: z.object({
		id: z.string().uuid(),
		requestedRef: z.string(),
		resolvedCommitSha: z.string().optional(),
	}).optional(),
	latestScanJob: z.object({
		id: z.string().uuid(),
		status: scanJobStatusSchema,
		stage: scanJobStageSchema,
		progress: z.number().min(0).max(100),
		canCancel: z.boolean(),
		diagnostics: z.array(diagnosticItemSchema).optional(),
		error: z
			.object({
				code: errorCodeSchema,
				message: z.string(),
			})
			.nullable(),
	}).optional(),
	latestSnapshot: z.object({
		id: z.string().uuid(),
		commitSha: z.string(),
		analyzerVersion: z.string(),
		coverageStatus: z.enum(['READY', 'PARTIAL']),
		indexStatus: snapshotIndexStatusSchema,
		diagnostics: z.array(diagnosticItemSchema).optional(),
		profile: repositoryProfileResponseSchema.optional(),
	}).optional(),
	createdAt: z.string(),
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
export type RepositoryProfileResponse = z.infer<typeof repositoryProfileResponseSchema>;
