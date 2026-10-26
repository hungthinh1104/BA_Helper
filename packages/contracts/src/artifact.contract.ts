import { z, type TypeOf as ZodTypeOf } from 'zod';
import { testCaseMetadataSchema } from './test-case.contract';

export const MAX_ARTIFACT_SEARCH_OFFSET = 500;

export const universalArtifactKindSchema = z.enum([
	'API_ENDPOINT',
	'DOMAIN_SERVICE',
	'DATA_MODEL',
	'TEST_FILE',
	'TEST_CASE',
	'UNKNOWN',
]);

export const artifactSchema = z.object({
	id: z.string().uuid(),
	artifactKey: z.string(),
	name: z.string(),
	artifactType: z.string(),
	universalKind: universalArtifactKindSchema,
	filePath: z.string(),
	startLine: z.number().nullable(),
	endLine: z.number().nullable(),
	language: z.string().nullable(),
	testCase: testCaseMetadataSchema.optional(),
});

export const artifactSearchTermSchema = z.string().trim().max(120).optional();

export const artifactListResponseSchema = z.object({
	items: z.array(artifactSchema),
	hasMore: z.boolean().optional(),
	limitReached: z.boolean().optional(),
	limit: z.number().int().positive().optional(),
	offset: z.number().int().nonnegative().optional(),
});

export type ArtifactListResponse = ZodTypeOf<typeof artifactListResponseSchema>;
export type UniversalArtifactKind = ZodTypeOf<typeof universalArtifactKindSchema>;
