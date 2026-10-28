import { useMutation, useQuery } from '@tanstack/react-query';
import {
  GenerateLocalizedReportRequest,
  LocalizedReportArtifact,
  localizedReportArtifactSchema,
  localizationStatusResponseSchema,
} from '@ba-helper/contracts';
import { apiGet, apiPost } from '@/lib/api-client';

export const localizationKeys = {
  all: ['localization'] as const,
  byAnalysis: (analysisId: string) => [...localizationKeys.all, analysisId] as const,
  status: (analysisId: string, locale: string) => [...localizationKeys.byAnalysis(analysisId), 'status', locale] as const,
};

export function useGenerateLocalizedReport(analysisId: string) {
  return useMutation({
    mutationFn: async (data: GenerateLocalizedReportRequest) => {
      const response = await apiPost<LocalizedReportArtifact>(
        `/api/v1/analyses/${analysisId}/localization`,
        data,
        localizedReportArtifactSchema,
      );
      return response;
    },
  });
}

export function useLocalizationStatus(analysisId: string, locale: string) {
  return useQuery({
    queryKey: localizationKeys.status(analysisId, locale),
    queryFn: async () => {
      const response = await apiGet(
        `/api/v1/analyses/${analysisId}/localization/${locale}/status`,
        localizationStatusResponseSchema,
      );
      return response;
    },
    refetchInterval: (query) => {
      // Auto-poll if it's queued
      return query.state.data?.status === 'QUEUED' ? 3000 : false;
    }
  });
}
