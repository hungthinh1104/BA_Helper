import { z } from 'zod';

export const failureCategorySchema = z.enum([
  'LEXICAL_MISMATCH',
  'DOMAIN_ALIAS_MISSING',
  'VECTOR_THIN_CHUNK',
  'EVIDENCE_LOCATION_ONLY',
  'SCANNER_MISSING_ARTIFACT',
  'GRAPH_EDGE_MISSING',
  'GRAPH_NOISE',
  'SUPPORT_FILE_OVER_RETRIEVED',
  'TEST_ARTIFACT_MISSED',
  'DATA_MODEL_MISSED',
  'INDIRECT_DEPENDENCY_MISSED',
  'LLM_EVIDENCE_OVERCLAIM',
  'STALE_SNAPSHOT_OR_INDEX',
]);

export const candidateArtifactSchema = z
  .object({
    artifactKey: z.string().min(1),
    filePath: z.string().min(1),
    artifactName: z.string().min(1),
    artifactType: z.string().min(1),
    universalKind: z.string().min(1).optional(),
    excerpt: z.string().optional(),
  })
  .strict();

export const groundTruthSchema = z
  .object({
    files: z.array(z.string().min(1)).min(1),
    methods: z.array(z.string().min(1)).optional(),
  })
  .strict();

export const reqImpactEvaluationCaseSchema = z
  .object({
    id: z.string().min(1),
    repo: z.string().min(1),
    issueUrl: z.string().url().optional(),
    prUrl: z.string().url().optional(),
    baseSha: z.string().min(1),
    headSha: z.string().min(1).optional(),
    commitSha: z.string().min(1).optional(),
    requirementText: z.string().min(1),
    groundTruth: groundTruthSchema,
    candidateArtifacts: z.array(candidateArtifactSchema).min(1),
    notes: z.string().optional(),
  })
  .strict();

export const retrievalRunConfigSchema = z
  .object({
    runId: z.string().min(1),
    mode: z.enum(['keyword', 'vector-only', 'hybrid', 'pure-llm', 'manual']),
    topK: z.number().int().positive(),
    snapshotCommitSha: z.string().min(1).optional(),
    notes: z.string().optional(),
  })
  .strict();

export const retrievedArtifactEvidenceSchema = z
  .object({
    hasEvidence: z.boolean(),
    excerptLength: z.number().int().nonnegative(),
    isLocationOnly: z.boolean(),
    isCodeLike: z.boolean(),
  })
  .strict();

export const retrievedArtifactResultSchema = z
  .object({
    rank: z.number().int().positive(),
    artifactKey: z.string().min(1),
    filePath: z.string().min(1),
    artifactType: z.string().min(1),
    score: z.number().optional(),
    finalScore: z.number().optional(),
    lexicalScore: z.number().optional(),
    vectorScore: z.number().optional(),
    graphScore: z.number().optional(),
    kindBoost: z.number().optional(),
    domainBoost: z.number().optional(),
    noisePenalty: z.number().optional(),
    retrievalSignals: z.array(z.string().min(1)),
    retrievalReason: z.string().optional(),
    evidence: retrievedArtifactEvidenceSchema,
  })
  .strict();

export const evaluationMetricsSchema = z
  .object({
    precision: z.number(),
    recall: z.number(),
    f1: z.number(),
    recallAt5: z.number(),
    recallAt10: z.number(),
    evidenceCoverage: z.number(),
    reviewBurden: z.number(),
  })
  .strict();

export const evaluationRunResultSchema = z
  .object({
    caseId: z.string().min(1),
    config: retrievalRunConfigSchema,
    retrievedArtifacts: z.array(retrievedArtifactResultSchema),
    metrics: evaluationMetricsSchema.optional(),
    failureCategories: z.array(failureCategorySchema).default([]),
    notes: z.string().optional(),
  })
  .strict();

export const reqImpactEvaluationDatasetSchema = z
  .object({
    version: z.literal('cases.v0').optional(),
    generatedBy: z.string().optional(),
    cases: z.array(reqImpactEvaluationCaseSchema),
  })
  .strict();

export const baselinePredictionSchema = z
  .object({
    caseId: z.string().min(1),
    predictedFiles: z.array(z.string().min(1)),
    rankedFiles: z.array(z.string().min(1)),
    evidenceBackedPredictedFiles: z.array(z.string().min(1)).default([]),
    reviewItems: z.number().int().nonnegative().default(0),
    notes: z.string().optional(),
  })
  .strict();

export const baselineRunSchema = z
  .object({
    baselineId: z.string().min(1),
    mode: z.enum(['deterministic', 'manual']),
    status: z.enum(['COMPLETED', 'SKIPPED']),
    notes: z.string().optional(),
    predictions: z.array(baselinePredictionSchema),
  })
  .strict();

export const metricsSummarySchema = z
  .object({
    evaluatedCases: z.number().int().nonnegative(),
    precision: z.number(),
    recall: z.number(),
    f1: z.number(),
    recallAt5: z.number(),
    recallAt10: z.number(),
    evidenceCoverage: z.number(),
    reviewBurden: z.number(),
  })
  .strict();

export const evaluationResultsSchema = z
  .object({
    version: z.literal('results.v0'),
    generatedAt: z.string(),
    datasetVersion: z.literal('cases.v0'),
    baselines: z.array(baselineRunSchema),
    metrics: z.record(metricsSummarySchema),
  })
  .strict();

export type FailureCategory = z.infer<typeof failureCategorySchema>;
export type GroundTruth = z.infer<typeof groundTruthSchema>;
export type CandidateArtifact = z.infer<typeof candidateArtifactSchema>;
export type ReqImpactEvaluationCase = z.infer<
  typeof reqImpactEvaluationCaseSchema
>;
export type RetrievalRunConfig = z.infer<typeof retrievalRunConfigSchema>;
export type RetrievedArtifactResult = z.infer<
  typeof retrievedArtifactResultSchema
>;
export type EvaluationMetrics = z.infer<typeof evaluationMetricsSchema>;
export type EvaluationRunResult = z.infer<typeof evaluationRunResultSchema>;
export type ReqImpactEvaluationDataset = z.infer<
  typeof reqImpactEvaluationDatasetSchema
>;

export type EvaluationCase = ReqImpactEvaluationCase;
export type EvaluationCandidateArtifact = CandidateArtifact;
export type EvaluationDataset = ReqImpactEvaluationDataset;
export type BaselinePrediction = z.infer<typeof baselinePredictionSchema>;
export type BaselineRun = z.infer<typeof baselineRunSchema>;
export type MetricsSummary = z.infer<typeof metricsSummarySchema>;
export type EvaluationResults = z.infer<typeof evaluationResultsSchema>;

export const evaluationCandidateArtifactSchema = candidateArtifactSchema;
export const evaluationCaseSchema = reqImpactEvaluationCaseSchema;
export const evaluationDatasetSchema = reqImpactEvaluationDatasetSchema;
