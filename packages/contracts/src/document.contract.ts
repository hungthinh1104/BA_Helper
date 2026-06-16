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
		staleStatusAtReadTime: z.boolean(),
	}),
});

export type DocumentListResponse = z.infer<typeof documentListResponseSchema>;
export type FinalizeImpactAnalysisRequest = z.infer<typeof finalizeImpactAnalysisRequestSchema>;
export type ApprovedImpactReportResponse = z.infer<typeof approvedImpactReportResponseSchema>;
