import { z } from 'zod';

export const testModifierSchema = z.enum(['NORMAL', 'SKIP', 'TODO', 'ONLY']);
export const testBehaviorKindSchema = z.enum([
  'SETUP_HOOK', 'TEARDOWN_HOOK', 'INPUT', 'ACTION', 'ASSERTION', 'MOCK', 'EXPECTED_OUTCOME',
]);
export const testSourceLocationSchema = z.object({
  relativePath: z.string().min(1).max(1000).refine(path =>
    !path.startsWith('/') && !path.includes('\\') &&
    path.split('/').every(segment => segment !== '' && segment !== '.' && segment !== '..')),
  /** UTF-16 source offsets; endOffset is exclusive. */
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().positive(),
  startLine: z.number().int().positive(),
  startColumn: z.number().int().positive(),
  endLine: z.number().int().positive(),
  endColumn: z.number().int().positive(),
}).refine(location => location.endOffset > location.startOffset);
export const testStaticBehaviorClaimSchema = z.object({
  kind: testBehaviorKindSchema,
  evidenceKind: z.literal('STATIC_DECLARATION'),
  sourceText: z.string().min(1).max(2000),
  sourceLocation: testSourceLocationSchema,
  commitSha: z.string().min(1).max(256),
  evidenceProvenanceKey: z.string().min(1).max(1000),
});
export const scanStaticBehaviorClaimSchema = testStaticBehaviorClaimSchema.extend({
  evidenceProvenanceKey: z.string().min(1).max(1000).optional(),
});
const testCaseMetadataBaseSchema = z.object({
  framework: z.literal('jest'),
  suitePath: z.array(z.string().max(1000)).max(20),
  title: z.string().min(1).max(1000),
  modifier: testModifierSchema,
  declaredModifier: testModifierSchema,
  parentFileArtifactKey: z.string().min(1),
  /** A single source callback, with no data-row expansion or execution claim. */
  parameterized: z.boolean().optional(),
});
/** Analyzer-side metadata before persistence binds claims to snapshot evidence. */
export const scanTestCaseMetadataSchema = testCaseMetadataBaseSchema.extend({
  behaviorEvidence: z.array(scanStaticBehaviorClaimSchema).max(100).optional(),
});
/** Persisted/API metadata requires evidence provenance for every behavior claim. */
export const testCaseMetadataSchema = testCaseMetadataBaseSchema.extend({
  /** Static source declarations only; never indicates test execution or coverage. */
  behaviorEvidence: z.array(testStaticBehaviorClaimSchema).max(100).optional(),
});

export const codeArtifactMetadataSchema = z.object({ testCase: testCaseMetadataSchema });
export type TestCaseMetadata = z.infer<typeof testCaseMetadataSchema>;
