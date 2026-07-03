import { z } from 'zod';
import { traceabilityReviewDecisionSchema } from './traceability.contract';
import { domainPackSelectedBySchema, domainProfileCapabilityStatusSchema } from './domain-pack.contract';

export const documentSchema = z.object({
	id: z.string().uuid(),
	type: z.enum(['IMPACT_REPORT']),
	status: z.enum(['DRAFT', 'APPROVED', 'STALE']),
	commitSha: z.string(),
	isStale: z.boolean(),
});

export const documentListResponseSchema = z.object({
	items: z.array(documentSchema),
});

export const documentJobStatusSchema = z.enum([
	'QUEUED',
	'RUNNING',
	'COMPLETED',
	'FAILED',
]);

export const documentJobSchema = z.object({
	id: z.string().uuid(),
	analysisId: z.string().uuid(),
	snapshotId: z.string().uuid(),
	documentType: z.enum(['IMPACT_REPORT']),
	status: documentJobStatusSchema,
	progress: z.number().int().min(0).max(100),
	requestKey: z.string().nullable().optional(),
	attemptCount: z.number().int().min(0),
	error: z.any().nullable().optional(),
	generatedDocumentId: z.string().uuid().nullable().optional(),
	lastStartedAt: z.string().nullable().optional(),
	completedAt: z.string().nullable().optional(),
	failedAt: z.string().nullable().optional(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const finalizeImpactAnalysisRequestSchema = z.object({
	acknowledgeUnreviewed: z.boolean().default(false),
});

export const evaluationContextSchema = z.object({
	datasetVersion: z.string(),
	subsetId: z.string(),
	subsetSize: z.string(),
	interpretation: z.literal('ILLUSTRATIVE_ONLY'),
	knownLimits: z.array(z.string()),
	evidenceQualityNotes: z.array(z.string()),
	datasetExpansionRecommendations: z.array(z.string()),
	researchFindingsArtifact: z.string(),
	sameSubsetComparisonArtifact: z.string(),
});

export const evidenceQualitySummarySchema = z.object({
	strongSourceEvidence: z.number().optional(),
	weakSourceEvidence: z.number().optional(),
	inferredFromStructure: z.number().optional(),
	domainHintOnly: z.number().optional(),
	missingEvidence: z.number(),
	conflictingEvidence: z.number().optional(),
	reviewRequired: z.number(),
	evidenced: z.number(),
	inferred: z.number(),
	weakEvidence: z.number(),
	STRONG_SOURCE_EVIDENCE: z.number().optional(),
	WEAK_SOURCE_EVIDENCE: z.number().optional(),
	INFERRED_FROM_STRUCTURE: z.number().optional(),
	DOMAIN_HINT_ONLY: z.number().optional(),
	MISSING_EVIDENCE: z.number().optional(),
	CONFLICTING_EVIDENCE: z.number().optional(),
	REVIEW_REQUIRED: z.number().optional(),
	DERIVED_ARTIFACT: z.number().optional(),
	derivedArtifact: z.number().optional(),
});

const evidenceQualityLabelSchema = z.enum([
	'STRONG_SOURCE_EVIDENCE',
	'WEAK_SOURCE_EVIDENCE',
	'INFERRED_FROM_STRUCTURE',
	'DOMAIN_HINT_ONLY',
	'MISSING_EVIDENCE',
	'CONFLICTING_EVIDENCE',
	'REVIEW_REQUIRED',
	'EVIDENCED',
	'INFERRED',
	'WEAK_EVIDENCE',
	'DERIVED_ARTIFACT',
]);

export const evidenceQualityItemSchema = z.object({
	itemType: z.enum(['TRACEABILITY_LINK', 'INSIGHT']).optional(),
	itemId: z.string().min(1).optional(),
	linkId: z.string().min(1).optional(),
	insightId: z.string().min(1).optional(),
	artifact: z.string(),
	quality: evidenceQualityLabelSchema,
	reasons: z.array(z.string()),
	reviewStatus: z.string().nullable().optional(),
	reviewDecision: traceabilityReviewDecisionSchema.optional().nullable(),
});

export const reportReviewCoverageSummarySchema = z.object({
	insights: z.object({
		total: z.number().int().nonnegative(),
		reviewed: z.number().int().nonnegative(),
		unreviewed: z.number().int().nonnegative(),
		confirmed: z.number().int().nonnegative(),
		rejected: z.number().int().nonnegative(),
		needsReview: z.number().int().nonnegative(),
	}),
	traceabilityLinks: z.object({
		total: z.number().int().nonnegative(),
		reviewed: z.number().int().nonnegative(),
		unreviewed: z.number().int().nonnegative(),
		accepted: z.number().int().nonnegative(),
		rejected: z.number().int().nonnegative(),
		needsReview: z.number().int().nonnegative(),
		needsMoreEvidence: z.number().int().nonnegative(),
	}),
	decisions: z.object({
		accepted: z.number().int().nonnegative(),
		rejected: z.number().int().nonnegative(),
		needsReview: z.number().int().nonnegative(),
		needsMoreEvidence: z.number().int().nonnegative(),
		needsClarification: z.number().int().nonnegative(),
		unreviewed: z.number().int().nonnegative(),
	}),
	evidence: z.object({
		strong: z.number().int().nonnegative(),
		weak: z.number().int().nonnegative(),
		missing: z.number().int().nonnegative(),
		conflicting: z.number().int().nonnegative(),
		reviewRequired: z.number().int().nonnegative(),
	}),
});

export const approvedImpactReportResponseSchema = z.object({
	id: z.string().uuid(),
	impactAnalysisId: z.string().uuid(),
	requirementRevisionId: z.string().uuid(),
	snapshotId: z.string().uuid(),
	sourceTargetId: z.string().uuid().optional(),
	type: z.literal('IMPACT_REPORT'),
	status: z.literal('APPROVED'),
	format: z.literal('MARKDOWN'),
	title: z.string(),
	markdown: z.string(),
	isStale: z.boolean(),
	staleReason: z.string().optional(),
	evaluationContext: evaluationContextSchema.nullable().optional(),
	evidenceQualitySummary: evidenceQualitySummarySchema.nullable().optional(),
	evidenceQualityItems: z.array(evidenceQualityItemSchema).nullable().optional(),
	reviewCoverageSummary: reportReviewCoverageSummarySchema.nullable().optional(),
	provenance: z.object({
		analysisId: z.string().uuid(),
		projectId: z.string().uuid(),
		repositoryId: z.string().uuid(),
		targetRef: z.string(),
		commitSha: z.string(),
		snapshotId: z.string().uuid(),
		analyzerVersion: z.string(),
		generatedDocumentId: z.string().uuid(),
		generatedAt: z.string(),
		finalizedAt: z.string().optional(),
		approvedDocumentCreatedAt: z.string().optional(),
		approvedDocumentUpdatedAt: z.string().optional(),
		staleStatusAtReadTime: z.boolean(),
		domainPack: z.object({
			requestedDomainPackId: z.string().nullable().optional(),
			domainPackId: z.string(),
			domainPackVersion: z.string(),
			domainPackStatus: domainProfileCapabilityStatusSchema,
			selectedBy: domainPackSelectedBySchema,
			resolvedAt: z.string().nullable().optional(),
			manifestDigest: z.string().nullable().optional(),
			registryVersion: z.string().nullable().optional(),
		}).nullable().optional(),
	}),
});

export const reviewedReportSnapshotSchema = z.object({
	id: z.string().uuid(),
	analysisId: z.string().uuid(),
	approvedDocumentId: z.string().uuid().nullable().optional(),
	markdown: z.string().nullable().optional(),
	reviewDecisionsSnapshot: z.any(),
	evidenceQualitySummarySnapshot: z.any(),
	reviewCoverageSummary: reportReviewCoverageSummarySchema.nullable().optional(),
	evaluationContextSnapshot: z.any().nullable().optional(),
	createdByUserId: z.string().uuid().nullable().optional(),
	createdAt: z.string(),
});

export type DocumentListResponse = z.infer<typeof documentListResponseSchema>;
export type DocumentJobStatus = z.infer<typeof documentJobStatusSchema>;
export type DocumentJob = z.infer<typeof documentJobSchema>;
export type FinalizeImpactAnalysisRequest = z.infer<typeof finalizeImpactAnalysisRequestSchema>;
export type ApprovedImpactReportResponse = z.infer<typeof approvedImpactReportResponseSchema>;
export type ReviewedReportSnapshotResponse = z.infer<typeof reviewedReportSnapshotSchema>;
export type ReportReviewCoverageSummary = z.infer<typeof reportReviewCoverageSummarySchema>;
