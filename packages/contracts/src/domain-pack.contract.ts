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

export const domainProfileCapabilityStatusSchema = z.enum([
  'STABLE',
  'PARTIAL',
  'EXPERIMENTAL',
  'FALLBACK',
]);

export const domainGlossaryLocaleSchema = z.enum(['en', 'vi']);

export const domainGlossaryMetadataSchema = z.object({
  locale: domainGlossaryLocaleSchema,
  status: z.string(),
  version: z.string(),
  termCount: z.number().int().nonnegative(),
});

export const domainPackSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  status: domainProfileCapabilityStatusSchema,
  description: z.string().optional(),
  glossaryMetadata: z.array(domainGlossaryMetadataSchema),
  concepts: z.array(domainConceptSchema),
  retrievalHints: z.array(domainRetrievalHintSchema),
  riskTemplates: z.array(domainRiskTemplateSchema),
  qaTemplates: z.array(domainQaTemplateSchema),
  unknownTemplates: z.array(domainUnknownTemplateSchema),
});

export const domainProfileRegistryEntrySchema = domainPackSchema.pick({
  id: true,
  name: true,
  version: true,
  status: true,
  description: true,
  glossaryMetadata: true,
});

export type DomainConcept = z.infer<typeof domainConceptSchema>;
export type DomainRetrievalHint = z.infer<typeof domainRetrievalHintSchema>;
export type DomainRiskTemplate = z.infer<typeof domainRiskTemplateSchema>;
export type DomainQaTemplate = z.infer<typeof domainQaTemplateSchema>;
export type DomainUnknownTemplate = z.infer<typeof domainUnknownTemplateSchema>;
export type DomainProfileCapabilityStatus = z.infer<typeof domainProfileCapabilityStatusSchema>;
export type DomainGlossaryLocale = z.infer<typeof domainGlossaryLocaleSchema>;
export type DomainGlossaryMetadata = z.infer<typeof domainGlossaryMetadataSchema>;
export type DomainPack = z.infer<typeof domainPackSchema>;
export type DomainProfileRegistryEntry = z.infer<typeof domainProfileRegistryEntrySchema>;
