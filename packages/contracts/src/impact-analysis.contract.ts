import { z } from 'zod';

export const impactAnalysisCreateRequestSchema = z.object({
	snapshotId: z.string().uuid(),
	sourceTargetId: z.string().uuid(),
	allowPartialSnapshot: z.boolean().default(false),
	requestKey: z.string().uuid(),
});

export const impactAnalysisStatusSchema = z.enum([
	'QUEUED',
	'RUNNING',
	'WAITING_FOR_REVIEW',
	'COMPLETED',
	'FAILED',
	'CANCELLED',
]);

export const impactAnalysisStageSchema = z.enum([
	'WAITING',
	'RETRIEVING_EVIDENCE',
	'EXPANDING_GRAPH',
	'RUNNING_AI_REASONING',
	'GENERATING_INSIGHTS',
	'GENERATING_DOCUMENTS',
	'DONE',
]);

export const impactAnalysisResponseSchema = z.object({
	id: z.string().uuid(),
	sourceTarget: z.object({
		id: z.string().uuid(),
		requestedRef: z.string(),
		resolvedRefType: z.enum(['BRANCH', 'TAG', 'COMMIT']),
		latestObservedCommitSha: z.string(),
	}),
	snapshot: z.object({
		id: z.string().uuid(),
		repositoryId: z.string().uuid(),
		commitSha: z.string(),
		analyzerVersion: z.string(),
		coverageStatus: z.enum(['READY', 'PARTIAL']),
	}),
	freshness: z.object({
		isStale: z.boolean(),
		isAnalyzerOutdated: z.boolean(),
		basis: z.enum(['LATEST_OBSERVED_SOURCE_TARGET', 'PINNED_COMMIT']),
	}),
	requirement: z.object({
		id: z.string().uuid(),
		revisionId: z.string().uuid(),
		revisionTitle: z.string(),
		rawText: z.string(),
	}),
	status: impactAnalysisStatusSchema,
	stage: impactAnalysisStageSchema,
	progress: z.number().min(0).max(100),
	coverageWarning: z.string().nullable(),
	capabilities: z.object({
		canReview: z.boolean(),
		canFinalize: z.boolean(),
		canExport: z.boolean(),
		canRerun: z.boolean(),
		canCancel: z.boolean(),
	}),
});

export const impactAnalysisListItemResponseSchema = z.object({
	id: z.string().uuid(),
	title: z.string(),
	status: impactAnalysisStatusSchema,
	stage: impactAnalysisStageSchema,
	isStale: z.boolean(),
	requirementRevisionTitle: z.string(),
	repositoryDisplayName: z.string(),
	snapshotCommitSha: z.string(),
	createdAt: z.string(),
	capabilities: z.object({
		canReview: z.boolean(),
		canFinalize: z.boolean(),
		canExport: z.boolean(),
	}),
});

export const impactAnalysisListResponseSchema = z.object({
	items: z.array(impactAnalysisListItemResponseSchema),
});

export type ImpactAnalysisCreateRequest = z.infer<typeof impactAnalysisCreateRequestSchema>;
export type ImpactAnalysisResponse = z.infer<typeof impactAnalysisResponseSchema>;
export type ImpactAnalysisDetailResponse = ImpactAnalysisResponse; // Alias for clarity
export type ImpactAnalysisListItemResponse = z.infer<typeof impactAnalysisListItemResponseSchema>;
export type ImpactAnalysisListResponse = z.infer<typeof impactAnalysisListResponseSchema>;
