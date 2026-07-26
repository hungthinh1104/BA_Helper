import { z } from 'zod';

export const requiredEvidenceAnchorSchema = z.object({
  artifactKey: z.string().min(1),
  contains: z.string().min(1).optional(),
});

export type RequiredEvidenceAnchor = z.infer<typeof requiredEvidenceAnchorSchema>;

export const evaluationCaseExpectedSchema = z.object({
  // Artifacts the pipeline MUST always surface (per-case recall floor = 1.0).
  // Optional so legacy cases keep working; falls back to `impactedArtifactKeys`.
  criticalArtifactKeys: z.array(z.string()).optional(),
  // Full impacted set graded for overall recall (aggregate floor) and, on the
  // committed/adjudicated layer, precision.
  impactedArtifactKeys: z.array(z.string()).min(1),
  // Artifacts that must NOT appear in the committed (evidenced-claim) layer.
  negativeArtifactKeys: z.array(z.string()).default([]),
  // Evidence-quality anchors: a found artifact's evidence excerpt must contain
  // the given substring.
  requiredEvidenceAnchors: z.array(requiredEvidenceAnchorSchema).optional(),
  universalKinds: z.array(z.string()).optional(),
  evidenceHints: z.array(z.string()).optional(),
  unknownsOrQuestions: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
  qaScenarios: z.array(z.string()).optional(),
});

export const evaluationCaseSchema = z.object({
  id: z.string().min(1),
  requirementTitle: z.string().min(1),
  requirementText: z.string().min(1),
  targetFixture: z.string().min(1),
  expected: evaluationCaseExpectedSchema,
  domain: z.object({
    packId: z.string(),
    expectedConceptKeys: z.array(z.string())
  }).optional(),
});

export type EvaluationCase = z.infer<typeof evaluationCaseSchema>;
export type EvaluationCaseExpected = z.infer<typeof evaluationCaseExpectedSchema>;

export const normalizedEvaluationResultSchema = z.object({
  // Layer 1 — the retrieval/traceability recall net (broad; graded for recall,
  // critical recall, and evidence coverage).
  foundImpactedArtifactKeys: z.array(z.string()),
  // Layer 2 — the AI-adjudicated EVIDENCED-claim set (what the system commits
  // to; graded for precision, negative control, and orphan claims). Defaults to
  // the Layer 1 net for adapters that do not distinguish the two layers.
  committedArtifactKeys: z.array(z.string()).optional(),
  evidenceByArtifactKey: z.record(z.array(z.string())), // key -> evidence excerpts
  unknownsOrQuestions: z.array(z.string()),
  risks: z.array(z.string()),
  qaScenarios: z.array(z.string()),
  domainPackId: z.string().optional(),
  domainPackVersion: z.string().optional(),
  matchedConceptKeys: z.array(z.string()).optional(),
});

export type NormalizedEvaluationResult = z.infer<typeof normalizedEvaluationResultSchema>;

export interface CaseScoreReport {
  caseId: string;
  artifactRecall: string;
  artifactPrecision: string;
  missingExpectedArtifacts: string[];
  unexpectedArtifacts: string[];
  negativeArtifactsFailed: string[];
  evidenceCoverage: string;
  unknownsMatched: string;
  risksMatched: string;
  qaScenariosMatched: string;
  domainPackId?: string;
  domainPackVersion?: string;
  expectedConceptKeys?: string[];
  matchedConceptKeys?: string[];
  missingConceptKeys?: string[];
  unexpectedConceptKeys?: string[];
  retrievalRecall?: number;
  retrievalPrecision?: number;
}

export interface DomainPackEvaluationSummary {
  totalCasesWithDomain: number;
  packIdsUsed: string[];
  conceptMatchRecall: string;
  missingExpectedConcepts: string[];
  unexpectedMatchedConcepts: string[];
  retrievalRecall: string;
  retrievalPrecision: string;
  safetyGuards: {
    noEvidenceFabrication: boolean;
    generalFallbackNoBookingHints: boolean;
    unsupportedVersionRejected: boolean;
    diagnosticBounded: boolean;
  };
}

export interface EvaluationSummaryReport {
  totalCases: number;
  averageArtifactRecall: string;
  averageArtifactPrecision: string;
  averageEvidenceCoverage: string;
  averageQaCoverage: string;
  failedCases: string[];
  cases: CaseScoreReport[];
  domainPackSummary?: DomainPackEvaluationSummary;
}
