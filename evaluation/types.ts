import { z } from 'zod';

export const evaluationCandidateArtifactSchema = z.object({
  artifactKey: z.string().min(1),
  filePath: z.string().min(1),
  artifactName: z.string().min(1),
  excerpt: z.string().default(''),
});

export const evaluationCaseSchema = z.object({
  id: z.string().min(1),
  repo: z.string().min(1),
  issueUrl: z.string().url(),
  prUrl: z.string().url().optional(),
  commitSha: z.string().min(1),
  requirementText: z.string().min(1),
  groundTruth: z.object({
    files: z.array(z.string().min(1)).default([]),
    methods: z.array(z.string().min(1)).default([]),
  }),
  candidateArtifacts: z.array(evaluationCandidateArtifactSchema).default([]),
  notes: z.string().default(''),
});

export const evaluationDatasetSchema = z.object({
  version: z.literal('cases.v0'),
  generatedBy: z.string().default('manual'),
  cases: z.array(evaluationCaseSchema),
});

export const baselinePredictionSchema = z.object({
  caseId: z.string().min(1),
  predictedFiles: z.array(z.string().min(1)),
  rankedFiles: z.array(z.string().min(1)),
  evidenceBackedPredictedFiles: z.array(z.string().min(1)).default([]),
  reviewItems: z.number().int().nonnegative().default(0),
  notes: z.string().optional(),
});

export const baselineRunSchema = z.object({
  baselineId: z.string().min(1),
  mode: z.enum(['deterministic', 'manual']),
  status: z.enum(['COMPLETED', 'SKIPPED']),
  notes: z.string().optional(),
  predictions: z.array(baselinePredictionSchema),
});

export const metricsSummarySchema = z.object({
  evaluatedCases: z.number().int().nonnegative(),
  precision: z.number(),
  recall: z.number(),
  f1: z.number(),
  recallAt5: z.number(),
  recallAt10: z.number(),
  evidenceCoverage: z.number(),
  reviewBurden: z.number(),
});

export const evaluationResultsSchema = z.object({
  version: z.literal('results.v0'),
  generatedAt: z.string(),
  datasetVersion: z.literal('cases.v0'),
  baselines: z.array(baselineRunSchema),
  metrics: z.record(metricsSummarySchema),
});

export type EvaluationCandidateArtifact = z.infer<
  typeof evaluationCandidateArtifactSchema
>;
export type EvaluationCase = z.infer<typeof evaluationCaseSchema>;
export type EvaluationDataset = z.infer<typeof evaluationDatasetSchema>;
export type BaselinePrediction = z.infer<typeof baselinePredictionSchema>;
export type BaselineRun = z.infer<typeof baselineRunSchema>;
export type MetricsSummary = z.infer<typeof metricsSummarySchema>;
export type EvaluationResults = z.infer<typeof evaluationResultsSchema>;
