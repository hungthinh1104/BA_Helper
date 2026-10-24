import { z } from 'zod';
import { codeEvidenceMetadataSchema } from './code-evidence.contract';
import { sourceLocationSchema } from './source-location.contract';

export const testSourceLocationSchema = sourceLocationSchema;

export const testModifierSchema = z.enum(['NORMAL', 'SKIP', 'TODO', 'ONLY']);
export const testBehaviorKindSchema = z.enum([
  'SETUP_HOOK', 'TEARDOWN_HOOK', 'INPUT', 'ACTION', 'ASSERTION', 'MOCK', 'EXPECTED_OUTCOME',
]);
export const testAssertionKindSchema = z.enum([
  'RETURN_VALUE', 'INVOCATION_ARGUMENTS', 'CALL_COUNT', 'EXCEPTION', 'STATE',
]);
export const testStaticBehaviorClaimSchema = z.object({
  kind: testBehaviorKindSchema,
  assertionKind: testAssertionKindSchema.optional(),
  evidenceKind: z.literal('STATIC_DECLARATION'),
  sourceText: z.string().min(1).max(2000),
  sourceLocation: testSourceLocationSchema,
  commitSha: z.string().min(1).max(256),
  evidenceProvenanceKey: z.string().min(1).max(1000),
  relatedInvocationSourceLocation: testSourceLocationSchema.optional(),
  relatedAssertionSourceLocation: testSourceLocationSchema.optional(),
  relatedSubjectText: z.string().min(1).max(2000).optional(),
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

export const codeArtifactMetadataSchema = z.object({
  testCase: testCaseMetadataSchema.optional(),
  codeEvidence: codeEvidenceMetadataSchema.optional(),
}).refine(value => value.testCase !== undefined || value.codeEvidence !== undefined, {
  message: 'Artifact metadata must contain a validated test case or code evidence payload.',
});
export type TestCaseMetadata = z.infer<typeof testCaseMetadataSchema>;
export type TestStaticBehaviorClaim = z.infer<typeof testStaticBehaviorClaimSchema>;
