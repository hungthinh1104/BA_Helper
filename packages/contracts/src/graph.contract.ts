import { z } from 'zod';

export const graphEdgeSchema = z.object({
	id: z.string().uuid(),
	fromArtifactId: z.string().uuid(),
	toArtifactId: z.string().uuid(),
	type: z.enum(['CALLS', 'REFERENCES', 'IMPORTS', 'TESTS']),
});

export const graphResponseSchema = z.object({
	edges: z.array(graphEdgeSchema),
});

export type GraphResponse = z.infer<typeof graphResponseSchema>;
