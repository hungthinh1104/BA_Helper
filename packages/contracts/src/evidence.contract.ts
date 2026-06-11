import { z } from 'zod';
import { retrievalMetadataSchema } from './retrieval.contract';

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
	artifactId: z.string().uuid().optional(),
	artifactKey: z.string().optional(),
	retrieval: retrievalMetadataSchema.optional(),
});

export const evidenceListResponseSchema = z.object({
	items: z.array(evidenceSchema),
});

export type EvidenceListResponse = z.infer<typeof evidenceListResponseSchema>;
