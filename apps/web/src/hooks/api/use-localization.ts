import { useMutation, useQuery } from '@tanstack/react-query';
import { GenerateLocalizedReportRequest, LocalizedReportArtifact } from '@ba-helper/contracts';
import { api } from '@/lib/api-client';

export const localizationKeys = {
  all: ['localization'] as const,
  byAnalysis: (analysisId: string) => [...localizationKeys.all, analysisId] as const,
};

export function useGenerateLocalizedReport(analysisId: string) {
  return useMutation({
    mutationFn: async (data: GenerateLocalizedReportRequest) => {
      const response = await api.post<LocalizedReportArtifact>(
        `/v1/analyses/${analysisId}/localization`,
        data
      );
      return response.data;
    },
  });
}
