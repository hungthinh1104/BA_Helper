import { z, type TypeOf as ZodTypeOf } from 'zod';

export const universalArtifactKindSchema = z.enum([
	'API_ENDPOINT',
	'DOMAIN_SERVICE',
	'DATA_MODEL',
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
});

export const artifactListResponseSchema = z.object({
	items: z.array(artifactSchema),
});

export type ArtifactListResponse = ZodTypeOf<typeof artifactListResponseSchema>;
export type UniversalArtifactKind = ZodTypeOf<typeof universalArtifactKindSchema>;
