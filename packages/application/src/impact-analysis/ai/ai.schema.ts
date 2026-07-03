import { z } from 'zod';

// Impact Analysis output schema
export const impactAnalysisAiSchema = z.object({
  executiveSummary: z.string().optional(),
  insights: z.array(z.object({
    insightKey: z.string(),
    insightType: z.enum(['CLAIM','UNKNOWN','QUESTION','ACCEPTANCE_CRITERIA','QA_SCENARIO']),
    certainty: z.enum(['EVIDENCED','INFERRED','UNKNOWN','CONFLICTING']),
    confidence: z.number().nullable(),
    title: z.string(),
    description: z.string(),
    reasoning: z.string().optional(),
    evidenceKeys: z.array(z.string()).optional(),
  })),
  unknowns: z.array(z.object({
    insightKey: z.string(),
    description: z.string(),
    reasoning: z.string(),
  })),
});

export type ImpactAnalysisAiResponse = z.infer<typeof impactAnalysisAiSchema>;
