import { z } from 'zod';

export const evidenceSchema = z.object({
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
});

export const evidenceListResponseSchema = z.object({
	items: z.array(evidenceSchema),
});

export type EvidenceListResponse = z.infer<typeof evidenceListResponseSchema>;
