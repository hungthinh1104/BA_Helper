import { useQuery } from '@tanstack/react-query';
import { testTraceEvidenceResponseSchema } from '@ba-helper/contracts';
import { apiGet } from '@/lib/api-client';
import { queryKeys } from '@/lib/api/query-keys';

export function useTestTraceEvidence(analysisId: string, evidenceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.analyses.testTraceEvidence(analysisId, evidenceId ?? ''),
    queryFn: () => apiGet(`/api/v1/impact-analyses/${encodeURIComponent(analysisId)}/qa-coverage/evidence/${encodeURIComponent(evidenceId ?? '')}`,
      testTraceEvidenceResponseSchema),
    enabled: Boolean(analysisId && evidenceId), retry: false,
  });
}
