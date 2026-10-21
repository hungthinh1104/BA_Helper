import { z } from 'zod';

export const testModifierSchema = z.enum(['NORMAL', 'SKIP', 'TODO', 'ONLY']);
export const testCaseMetadataSchema = z.object({
  framework: z.literal('jest'),
  suitePath: z.array(z.string().max(1000)).max(20),
  title: z.string().min(1).max(1000),
  modifier: testModifierSchema,
  declaredModifier: testModifierSchema,
  parentFileArtifactKey: z.string().min(1),
  /** A single source callback, with no data-row expansion or execution claim. */
  parameterized: z.boolean().optional(),
});

export const codeArtifactMetadataSchema = z.object({ testCase: testCaseMetadataSchema });
export type TestCaseMetadata = z.infer<typeof testCaseMetadataSchema>;
