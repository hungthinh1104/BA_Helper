import { z } from 'zod';
import { snapshotIndexStatusSchema } from './repository.contract';
import { diagnosticItemSchema, DiagnosticItem } from './diagnostic.contract';

export const impactAnalysisCreateRequestSchema = z.object({
	snapshotId: z.string().uuid(),
	sourceTargetId: z.string().uuid(),
	allowPartialSnapshot: z.boolean().default(false),
	requestKey: z.string().uuid(),
	derivedFromAnalysisId: z.string().uuid().optional(),
	sourceClarificationId: z.string().uuid().optional(),
}).superRefine((data, ctx) => {
	if (data.derivedFromAnalysisId && !data.sourceClarificationId) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'sourceClarificationId must be provided when derivedFromAnalysisId is provided',
			path: ['sourceClarificationId'],
		});
	}
	if (!data.derivedFromAnalysisId && data.sourceClarificationId) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'derivedFromAnalysisId must be provided when sourceClarificationId is provided',
			path: ['derivedFromAnalysisId'],
		});
	}
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

export const analysisErrorSchema = z.object({
	code: z.string(),
	message: z.string(),
	stage: z.string().optional(),
	retryable: z.boolean().optional(),
});


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
		indexStatus: snapshotIndexStatusSchema,
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
	derivedFromAnalysisId: z.string().uuid().nullable().optional(),
	sourceClarificationId: z.string().uuid().nullable().optional(),
	error: analysisErrorSchema.nullable().optional(),
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
	derivedFromAnalysisId: z.string().uuid().nullable().optional(),
	sourceClarificationId: z.string().uuid().nullable().optional(),
	error: analysisErrorSchema.nullable().optional(),
});

export const impactAnalysisListResponseSchema = z.object({
	items: z.array(impactAnalysisListItemResponseSchema),
});

export const diffArtifactSchema = z.object({
	artifactKey: z.string(),
	name: z.string(),
	artifactType: z.string(),
	filePath: z.string(),
	reviewStatus: z.enum(['NEEDS_REVIEW', 'CONFIRMED', 'REJECTED']),
});

export const diffInsightSchema = z.object({
	insightKey: z.string(),
	category: z.enum(['CLAIM', 'UNKNOWN', 'QUESTION', 'ACCEPTANCE_CRITERIA', 'QA_SCENARIO']),
	statement: z.string(),
	reviewStatus: z.enum(['NEEDS_REVIEW', 'CONFIRMED', 'REJECTED']),
});

export const impactAnalysisDiffResponseSchema = z.object({
	baseAnalysisId: z.string().uuid(),
	currentAnalysisId: z.string().uuid(),

	comparisonContext: z.object({
		requirementChanged: z.boolean(),
		snapshotChanged: z.boolean(),
		baseRequirementRevisionId: z.string().uuid(),
		currentRequirementRevisionId: z.string().uuid(),
		baseSnapshotId: z.string().uuid(),
		currentSnapshotId: z.string().uuid(),
		baseCommitSha: z.string().optional(),
		currentCommitSha: z.string().optional(),
		sourceClarificationId: z.string().uuid().optional(),
	}),

	summary: z.object({
		addedImpacts: z.number(),
		removedImpacts: z.number(),
		unchangedImpacts: z.number(),
		resolvedUnknowns: z.number(),
		removedUnknowns: z.number(),
		newUnknowns: z.number(),
		addedQaScenarios: z.number(),
	}),

	addedArtifacts: z.array(diffArtifactSchema),
	removedArtifacts: z.array(diffArtifactSchema),
	unchangedArtifacts: z.array(diffArtifactSchema),

	resolvedUnknowns: z.array(diffInsightSchema),
	removedUnknowns: z.array(diffInsightSchema),
	newUnknowns: z.array(diffInsightSchema),
	addedQaScenarios: z.array(diffInsightSchema),

	diagnostics: z.array(diagnosticItemSchema).optional(),
});

export type ImpactAnalysisCreateRequest = z.infer<typeof impactAnalysisCreateRequestSchema>;
export type ImpactAnalysisResponse = z.infer<typeof impactAnalysisResponseSchema>;
export type ImpactAnalysisDetailResponse = ImpactAnalysisResponse; // Alias for clarity
export type ImpactAnalysisListItemResponse = z.infer<typeof impactAnalysisListItemResponseSchema>;
export type ImpactAnalysisListResponse = z.infer<typeof impactAnalysisListResponseSchema>;
export type ImpactAnalysisDiffResponse = z.infer<typeof impactAnalysisDiffResponseSchema>;
export type DiffArtifact = z.infer<typeof diffArtifactSchema>;
export type DiffInsight = z.infer<typeof diffInsightSchema>;

export const reviewDecisionRequestSchema = z.object({
	decision: z.enum(['ACCEPTED', 'REJECTED', 'NEEDS_MORE_CLARIFICATION']),
	note: z.string().max(2000).optional(),
});

export const reviewDecisionResponseSchema = z.object({
	id: z.string().uuid(),
	analysisId: z.string().uuid(),
	decision: z.enum(['ACCEPTED', 'REJECTED', 'NEEDS_MORE_CLARIFICATION']),
	note: z.string().nullable(),
	reviewedBy: z.string(),
	createdAt: z.string(),
});

export const reviewDecisionListResponseSchema = z.object({
	items: z.array(reviewDecisionResponseSchema),
});

export const reviewDecisionCreateResponseSchema = z.object({
	decision: reviewDecisionResponseSchema,
	reportRegenerated: z.boolean(),
	reportRegenerationError: z.string().optional(),
});

export type ReviewDecisionRequest = z.infer<typeof reviewDecisionRequestSchema>;
export type ReviewDecisionResponse = z.infer<typeof reviewDecisionResponseSchema>;
export type ReviewDecisionListResponse = z.infer<typeof reviewDecisionListResponseSchema>;
export type ReviewDecisionCreateResponse = z.infer<typeof reviewDecisionCreateResponseSchema>;
