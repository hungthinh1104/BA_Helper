import { z } from 'zod';
import { domainPackSelectedBySchema, domainProfileCapabilityStatusSchema } from './domain-pack.contract';

export const retrievalSignalSchema = z.enum([
  'LEXICAL',
  'GRAPH',
  'VECTOR',
  'DOMAIN',
  'KIND',
]);

export const retrievalSignalsSchema = z.array(retrievalSignalSchema);

export const retrievalDiagnosticsSchema = z.object({
  version: z.literal('retrieval-diagnostics@0.1.0'),
  lexicalScoreNorm: z.number().finite(),
  vectorScoreNorm: z.number().finite(),
  graphBoostNorm: z.number().finite(),
  kindBoostNorm: z.number().finite(),
  domainBoostNorm: z.number().finite(),
  matchedIntentLabels: z.array(z.enum(['API', 'SERVICE', 'DATA', 'TEST'])),
  universalKind: z.string().nullable(),
  repositoryProfile: z.object({
    domain: z.string().nullable().optional(),
    framework: z.string().nullable().optional(),
    language: z.string().nullable().optional(),
    domainPackFallback: z.boolean().optional(),
  }).nullable(),
  matchedDomainTerms: z.array(z.string()).optional(),
  domainPack: z.object({
    id: z.string(),
    version: z.string(),
    status: domainProfileCapabilityStatusSchema,
    selectedBy: domainPackSelectedBySchema,
  }).optional(),
  finalScore: z.number().finite(),
});

export const retrievalMetadataSchema = z.object({
  method: z.enum(["LEXICAL", "GRAPH_EXPANSION", "VECTOR", "HYBRID"]),
  signals: retrievalSignalsSchema.optional(),
  reason: z.string().optional(),
  strategyVersion: z.string().optional(),
  diagnostics: retrievalDiagnosticsSchema.optional(),
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
export type RetrievalSignal = z.infer<typeof retrievalSignalSchema>;
export type RetrievalDiagnostics = z.infer<typeof retrievalDiagnosticsSchema>;
