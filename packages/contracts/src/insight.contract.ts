import { z } from 'zod';

export const insightReviewRequestSchema = z.object({
	reviewStatus: z.enum(['CONFIRMED', 'REJECTED']),
});

export const insightSchema = z.object({
	id: z.string().uuid(),
	category: z.enum([
		'CLAIM',
		'UNKNOWN',
		'QUESTION',
		'ACCEPTANCE_CRITERIA',
		'QA_SCENARIO',
	]),
	statement: z.string(),
	certainty: z.enum(['EVIDENCED', 'INFERRED', 'UNKNOWN', 'CONFLICTING']),
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

export const insightListResponseSchema = z.object({
	items: z.array(insightSchema),
});

export type InsightListResponse = z.infer<typeof insightListResponseSchema>;
export type InsightReviewRequest = z.infer<typeof insightReviewRequestSchema>;
