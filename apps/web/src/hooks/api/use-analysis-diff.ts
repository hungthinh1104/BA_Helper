import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import { ImpactAnalysisDiffResponse, impactAnalysisDiffResponseSchema } from "@ba-helper/contracts"

export function useAnalysisDiff(analysisId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.analyses.diff(analysisId),
    queryFn: async () => {
      return apiGet<ImpactAnalysisDiffResponse>(
        `/api/v1/impact-analyses/${analysisId}/diff`,
        impactAnalysisDiffResponseSchema
      )
    },
    enabled: Boolean(analysisId) && enabled,
    refetchOnWindowFocus: true,
  })
}
