import { z } from 'zod';
import { dependencyConfidenceSchema, dependencyEdgeProvenanceSchema } from './dependency-provenance.contract';
import { diagnosticItemSchema } from './diagnostic.contract';
import { testCaseMetadataSchema, testStaticBehaviorClaimSchema } from './test-case.contract';

export const comprehensionArtifactSchema = z.object({
  id: z.string().uuid(),
  artifactKey: z.string().min(1),
  name: z.string().min(1),
  artifactType: z.string().min(1),
  universalKind: z.string().min(1),
  filePath: z.string().min(1),
  startLine: z.number().int().positive().nullable(),
  endLine: z.number().int().positive().nullable(),
});

export const comprehensionEvidenceSchema = z.object({
  id: z.string().uuid().nullable(),
  evidenceKind: z.enum(['PRODUCTION_SOURCE', 'STATIC_TEST_DECLARATION', 'STATIC_EDGE']),
  sourceType: z.enum(['CODE', 'TEST', 'STATIC_ANALYSIS']),
  artifactId: z.string().uuid().nullable(),
  provenanceKey: z.string().min(1).nullable(),
  filePath: z.string().min(1),
  startLine: z.number().int().positive().nullable(),
  endLine: z.number().int().positive().nullable(),
  excerpt: z.string(),
  commitSha: z.string().min(1),
});

export const comprehensionRelationshipSchema = z.object({
  edgeId: z.string().uuid(),
  type: z.enum(['CALLS', 'TESTS', 'REFERENCES', 'IMPORTS']),
  sourceArtifactId: z.string().uuid(),
  targetArtifactId: z.string().uuid(),
  confidence: dependencyConfidenceSchema.optional(),
  provenance: dependencyEdgeProvenanceSchema.optional(),
  evidence: comprehensionEvidenceSchema.optional(),
});

export const comprehensionBehaviorAssociationSchema = z.object({
  associationId: z.string().min(1).max(1000),
  invocation: testStaticBehaviorClaimSchema.optional(),
  assertion: testStaticBehaviorClaimSchema,
  expectedOutcomes: z.array(testStaticBehaviorClaimSchema).max(20),
  mockedBoundaries: z.array(testStaticBehaviorClaimSchema).max(20),
  basis: z.enum(['AST_SUBJECT_REFERENCE', 'UNRESOLVED']),
  unresolved: z.array(diagnosticItemSchema).max(10),
});

export const comprehensionScenarioSchema = z.object({
  testArtifact: comprehensionArtifactSchema,
  testCase: testCaseMetadataSchema.optional(),
  setup: z.array(testStaticBehaviorClaimSchema).max(100),
  inputs: z.array(testStaticBehaviorClaimSchema).max(100),
  invocations: z.array(testStaticBehaviorClaimSchema).max(100),
  assertions: z.array(testStaticBehaviorClaimSchema).max(100),
  mockedBoundaries: z.array(testStaticBehaviorClaimSchema).max(100),
  expectedOutcomes: z.array(testStaticBehaviorClaimSchema).max(100),
  /** Added additively; legacy projections parse as an empty association list. */
  behaviorAssociations: z.array(comprehensionBehaviorAssociationSchema).max(100).default([]),
  trace: z.object({
    relation: z.enum(['DIRECT_REFERENCE', 'CALL_PATH']),
    artifacts: z.array(comprehensionArtifactSchema).min(2).max(6),
    relationships: z.array(comprehensionRelationshipSchema).min(1).max(5),
  }).optional(),
  unresolved: z.array(diagnosticItemSchema).max(20),
});

export const codeComprehensionResponseSchema = z.object({
  selectedCode: comprehensionArtifactSchema,
  codeEvidence: z.object({
    source: comprehensionEvidenceSchema,
    parameters: z.array(comprehensionEvidenceSchema).max(20),
    returnType: comprehensionEvidenceSchema.nullable(),
    conditions: z.array(comprehensionEvidenceSchema).max(20),
    exceptionHandlers: z.array(comprehensionEvidenceSchema).max(20),
    dependencies: z.array(comprehensionArtifactSchema).max(50),
    staticCalls: z.array(comprehensionRelationshipSchema).max(50),
  }),
  relatedScenarios: z.array(comprehensionScenarioSchema).max(50),
  scenarioPagination: z.object({
    limit: z.number().int().positive().max(50),
    offset: z.number().int().nonnegative().max(500),
    hasMore: z.boolean(),
  }).default({ limit: 50, offset: 0, hasMore: false }),
  limitations: z.array(diagnosticItemSchema).max(50),
  snapshotContext: z.object({
    repositoryId: z.string().uuid(),
    snapshotId: z.string().uuid(),
    commitSha: z.string().min(1),
    analyzerVersion: z.string().min(1),
    coverageStatus: z.enum(['READY', 'PARTIAL']),
    basis: z.literal('STATIC_SOURCE_REFERENCE'),
    runtimeObservations: z.literal('NOT_IMPORTED'),
  }),
  limits: z.object({
    maxCallDepth: z.number().int().positive(),
    maxScenarios: z.number().int().positive(),
    maxRelationships: z.number().int().positive(),
  }),
  truncated: z.boolean(),
});

export type ComprehensionArtifact = z.infer<typeof comprehensionArtifactSchema>;
export type ComprehensionEvidence = z.infer<typeof comprehensionEvidenceSchema>;
export type ComprehensionRelationship = z.infer<typeof comprehensionRelationshipSchema>;
export type ComprehensionBehaviorAssociation = z.infer<typeof comprehensionBehaviorAssociationSchema>;
export type ComprehensionScenario = z.infer<typeof comprehensionScenarioSchema>;
export type CodeComprehensionResponse = z.infer<typeof codeComprehensionResponseSchema>;
