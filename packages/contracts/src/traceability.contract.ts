import { z } from 'zod';
import { retrievalMetadataSchema } from './retrieval.contract';
import { evidenceSchema } from './evidence.contract';
import { universalArtifactKindSchema } from './artifact.contract';

export const traceabilityReviewRequestSchema = z.object({
	reviewStatus: z.enum(['CONFIRMED', 'REJECTED']),
});

export const traceabilityReviewDecisionValueSchema = z.enum([
	'ACCEPTED',
	'REJECTED',
	'NEEDS_REVIEW',
	'NEEDS_MORE_EVIDENCE',
]);

export const traceabilityReviewDecisionSchema = z.object({
	id: z.string().uuid(),
	analysisId: z.string().uuid(),
	traceabilityLinkId: z.string().uuid(),
	decision: traceabilityReviewDecisionValueSchema,
	note: z.string().optional().nullable(),
	reviewedByUserId: z.string().optional().nullable(),
	reviewedAt: z.string(), // ISO string
});

export const updateTraceabilityReviewDecisionRequestSchema = z.object({
	decision: traceabilityReviewDecisionValueSchema,
	note: z.string().optional().nullable(),
});

export const traceabilityLinkSchema = z.object({
	id: z.string().uuid(),
	artifactId: z.string().uuid(),
	artifactName: z.string(),
	artifactKey: z.string(),
	filePath: z.string().nullable(),
	universalKind: universalArtifactKindSchema,
	linkType: z.enum(['AFFECTED', 'RELATED']),
	linkBasis: z.enum(['EVIDENCED', 'INFERRED']),
	reviewStatus: z.enum(['NEEDS_REVIEW', 'CONFIRMED', 'REJECTED']),
	confidence: z.number().min(0).max(1).nullable(),
	retrieval: retrievalMetadataSchema.optional(),
	evidence: z.array(evidenceSchema),
	reviewDecision: traceabilityReviewDecisionSchema.optional().nullable(),
});

export const traceabilityLinkListResponseSchema = z.object({
	items: z.array(traceabilityLinkSchema),
});

export type TraceabilityLinkListResponse = z.infer<
	typeof traceabilityLinkListResponseSchema
>;
export type TraceabilityReviewRequest = z.infer<
	typeof traceabilityReviewRequestSchema
>;
