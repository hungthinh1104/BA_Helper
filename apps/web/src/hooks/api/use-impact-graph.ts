import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import { impactGraphResponseSchema, ImpactGraphResponse } from "@ba-helper/contracts"

export function useImpactGraph(analysisId: string | undefined) {
  return useQuery<ImpactGraphResponse>({
    queryKey: queryKeys.analyses.graph(analysisId ?? ""),
    queryFn: () =>
      apiGet<ImpactGraphResponse>(
        `/api/v1/impact-analyses/${analysisId}/graph`,
        impactGraphResponseSchema,
      ),
    enabled: Boolean(analysisId),
    staleTime: 30_000,
  })
}
