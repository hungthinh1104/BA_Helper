import { z } from 'zod';

const artifactKeyList = z.array(z.string()).default([]);

const baseInsightSchema = z.object({
  insightKey: z.string(),
  insightType: z.enum(['CLAIM','UNKNOWN','QUESTION','ACCEPTANCE_CRITERIA','QA_SCENARIO']),
  certainty: z.enum(['EVIDENCED','INFERRED','UNKNOWN','CONFLICTING']),
  confidence: z.number().nullable(),
  title: z.string(),
  description: z.string(),
  reasoning: z.string().optional(),
  evidenceKeys: artifactKeyList.optional(),
  relatedArtifactKeys: artifactKeyList.optional(),
  given: z.string().optional(),
  when: z.string().optional(),
  then: z.string().optional(),
  kind: z.enum(['risk']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  category: z.string().optional(),
});

// Impact Analysis output schema
export const impactAnalysisAiSchema = z.object({
  executiveSummary: z.string().optional(),
  insights: z.array(baseInsightSchema),
  unknowns: z.array(z.object({
    insightKey: z.string(),
    description: z.string(),
    reasoning: z.string(),
    evidenceKeys: artifactKeyList.optional(),
    relatedArtifactKeys: artifactKeyList.optional(),
  })).default([]),
});

export type ImpactAnalysisAiResponse = z.infer<typeof impactAnalysisAiSchema>;
