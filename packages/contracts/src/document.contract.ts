import { z } from 'zod';

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
	evidenced: z.number(),
	inferred: z.number(),
	weakEvidence: z.number(),
	missingEvidence: z.number(),
	reviewRequired: z.number(),
});

export const evidenceQualityItemSchema = z.object({
	artifact: z.string(),
	quality: z.enum([
		'EVIDENCED',
		'INFERRED',
		'WEAK_EVIDENCE',
		'MISSING_EVIDENCE',
		'REVIEW_REQUIRED',
	]),
	reasons: z.array(z.string()),
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
	}),
});

export type DocumentListResponse = z.infer<typeof documentListResponseSchema>;
export type FinalizeImpactAnalysisRequest = z.infer<typeof finalizeImpactAnalysisRequestSchema>;
export type ApprovedImpactReportResponse = z.infer<typeof approvedImpactReportResponseSchema>;
