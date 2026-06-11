import { z } from 'zod';

export const documentSchema = z.object({
	id: z.string().uuid(),
	type: z.enum(['IMPACT_REPORT']),
	status: z.enum(['DRAFT', 'APPROVED']),
	commitSha: z.string(),
	isStale: z.boolean(),
});

export const documentListResponseSchema = z.object({
	items: z.array(documentSchema),
});

export const finalizeImpactAnalysisRequestSchema = z.object({
	acknowledgeUnreviewed: z.boolean().default(false),
});

export type DocumentListResponse = z.infer<typeof documentListResponseSchema>;
export type FinalizeImpactAnalysisRequest = z.infer<
	typeof finalizeImpactAnalysisRequestSchema
>;
