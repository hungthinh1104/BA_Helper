import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';
import { EventLogListResponse } from '@ba-helper/contracts';

// Query keys
export const eventLogKeys = {
  all: ['event-logs'] as const,
  scanJob: (jobId: string) => [...eventLogKeys.all, 'scan-job', jobId] as const,
  analysis: (analysisId: string) => [...eventLogKeys.all, 'analysis', analysisId] as const,
};

export function useScanJobEvents(repositoryId: string, jobId: string | undefined) {
  return useQuery({
    queryKey: eventLogKeys.scanJob(jobId || ''),
    queryFn: async () => {
      const data = await apiGet<EventLogListResponse>(
        `/api/v1/repositories/${repositoryId}/scan-jobs/${jobId}/events`
      );
      return data;
    },
    enabled: Boolean(jobId && repositoryId),
  });
}

export function useAnalysisEvents(analysisId: string | undefined) {
  return useQuery({
    queryKey: eventLogKeys.analysis(analysisId || ''),
    queryFn: async () => {
      const data = await apiGet<EventLogListResponse>(
        `/api/v1/impact-analyses/${analysisId}/events`
      );
      return data;
    },
    enabled: Boolean(analysisId),
  });
}
