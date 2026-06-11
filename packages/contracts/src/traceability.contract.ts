import { z } from 'zod';
import { retrievalMetadataSchema } from './retrieval.contract';
import { evidenceSchema } from './evidence.contract';

export const traceabilityReviewRequestSchema = z.object({
	reviewStatus: z.enum(['CONFIRMED', 'REJECTED']),
});

export const traceabilityLinkSchema = z.object({
	id: z.string().uuid(),
	artifactId: z.string().uuid(),
	linkType: z.enum(['AFFECTED', 'RELATED']),
	linkBasis: z.enum(['EVIDENCED', 'INFERRED']),
	reviewStatus: z.enum(['NEEDS_REVIEW', 'CONFIRMED', 'REJECTED']),
	confidence: z.number().min(0).max(1).nullable(),
	retrieval: retrievalMetadataSchema.optional(),
	evidence: z.array(evidenceSchema),
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
