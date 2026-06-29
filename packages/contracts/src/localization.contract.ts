import { z } from 'zod';

export const supportedReportLocales = ['en', 'vi-VN', 'ja-JP'] as const;
export type SupportedReportLocale = typeof supportedReportLocales[number];

export const localizationStatusSchema = z.enum(['QUEUED', 'COMPLETED', 'FAILED']);
export type LocalizationStatus = z.infer<typeof localizationStatusSchema>;

export const localizedReportArtifactSchema = z.object({
  id: z.string().uuid(),
  sourceDocumentId: z.string().uuid(),
  locale: z.enum(supportedReportLocales),
  sourceLocale: z.string(),
  localizationStatus: localizationStatusSchema,
  contentMarkdown: z.string().nullable(),
  sourceContentHash: z.string(),
  
  glossaryVersion: z.string().nullable(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  translationPromptVersion: z.string().nullable(),
  structuralValidatorVersion: z.string().nullable(),
  fieldPolicyVersion: z.string().nullable(),
  errorCode: z.string().nullable(),
  
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type LocalizedReportArtifact = z.infer<typeof localizedReportArtifactSchema>;

export const generateLocalizedReportRequestSchema = z.object({
  locale: z.enum(supportedReportLocales),
});

export type GenerateLocalizedReportRequest = z.infer<typeof generateLocalizedReportRequestSchema>;

export const localizationStatusResponseSchema = z.object({
  status: z.enum(['READY', 'NOT_TRANSLATED', 'QUEUED', 'FAILED', 'OUT_OF_SYNC', 'SOURCE_NOT_READY']),
});

export type LocalizationStatusResponse = z.infer<typeof localizationStatusResponseSchema>;
