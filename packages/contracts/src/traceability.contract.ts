import { z } from 'zod';

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
	evidence: z.array(
		z.object({
			id: z.string().uuid(),
			sourceType: z.enum([
				'CODE',
				'TEST',
				'STATIC_ANALYSIS',
				'REQUIREMENT_INPUT',
				'COVERAGE',
				'HUMAN_NOTE',
			]),
			filePath: z.string().nullable(),
			startLine: z.number().nullable(),
			endLine: z.number().nullable(),
			excerpt: z.string(),
		}),
	),
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
