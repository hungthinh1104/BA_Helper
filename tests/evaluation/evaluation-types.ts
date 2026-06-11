import { z } from 'zod';

export const evaluationCaseExpectedSchema = z.object({
  impactedArtifactKeys: z.array(z.string()).min(1),
  negativeArtifactKeys: z.array(z.string()).default([]),
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
  foundImpactedArtifactKeys: z.array(z.string()),
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
