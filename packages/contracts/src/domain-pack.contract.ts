import { z } from 'zod';

export const domainConceptSchema = z.object({
  key: z.string(),
  label: z.string(),
  aliases: z.array(z.string()),
  relatedArtifactKeywords: z.array(z.string()),
  relatedKinds: z.array(z.string()),
});

export const domainRetrievalHintSchema = z.string();

export const domainRiskTemplateSchema = z.string();

export const domainQaTemplateSchema = z.string();

export const domainUnknownTemplateSchema = z.string();

export const domainPackSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  concepts: z.array(domainConceptSchema),
  retrievalHints: z.array(domainRetrievalHintSchema),
  riskTemplates: z.array(domainRiskTemplateSchema),
  qaTemplates: z.array(domainQaTemplateSchema),
  unknownTemplates: z.array(domainUnknownTemplateSchema),
});

export type DomainConcept = z.infer<typeof domainConceptSchema>;
export type DomainRetrievalHint = z.infer<typeof domainRetrievalHintSchema>;
export type DomainRiskTemplate = z.infer<typeof domainRiskTemplateSchema>;
export type DomainQaTemplate = z.infer<typeof domainQaTemplateSchema>;
export type DomainUnknownTemplate = z.infer<typeof domainUnknownTemplateSchema>;
export type DomainPack = z.infer<typeof domainPackSchema>;
