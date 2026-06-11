import { z } from 'zod';

export const retrievalMetadataSchema = z.object({
  method: z.enum(["LEXICAL", "GRAPH_EXPANSION", "VECTOR", "HYBRID"]),
  signals: z.array(z.enum(["LEXICAL", "GRAPH", "VECTOR", "DOMAIN"])).optional(),
  reason: z.string().optional(),
  strategyVersion: z.string().optional(),
  score: z.object({
    final: z.number(),
    lexical: z.number().optional(),
    graph: z.number().optional(),
    vector: z.number().optional(),
    domain: z.number().optional(),
  }).optional(),
  suggestion: z.object({
    version: z.string(),
    confidence: z.enum(["STRONG", "MODERATE", "WEAK"]),
    why: z.string(),
    suggestedAction: z.string(),
    qaFocus: z.string().optional(),
    baQuestion: z.string().optional(),
    risk: z.string().optional(),
  }).optional(),
});

export type RetrievalMetadata = z.infer<typeof retrievalMetadataSchema>;
