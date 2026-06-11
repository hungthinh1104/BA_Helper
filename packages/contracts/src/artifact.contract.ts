import { z, type TypeOf as ZodTypeOf } from 'zod';

export const artifactSchema = z.object({
	id: z.string().uuid(),
	artifactKey: z.string(),
	name: z.string(),
	artifactType: z.string(),
	filePath: z.string(),
	startLine: z.number().nullable(),
	endLine: z.number().nullable(),
	language: z.string().nullable(),
});

export const artifactListResponseSchema = z.object({
	items: z.array(artifactSchema),
});

export type ArtifactListResponse = ZodTypeOf<typeof artifactListResponseSchema>;
