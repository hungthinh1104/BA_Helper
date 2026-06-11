import { useQuery } from '@tanstack/react-query'
import { QaCoverageResponse, qaCoverageResponseSchema } from '@ba-helper/contracts'
import { apiGet } from '@/lib/api-client'
import { queryKeys } from '@/lib/api/query-keys'

export function useQaCoverage(analysisId: string | undefined) {
  return useQuery<QaCoverageResponse>({
    queryKey: queryKeys.analyses.qaCoverage(analysisId ?? ''),
    queryFn: () =>
      apiGet<QaCoverageResponse>(
        `/api/v1/impact-analyses/${analysisId}/qa-coverage`,
        qaCoverageResponseSchema,
      ),
    enabled: Boolean(analysisId),
  })
}
