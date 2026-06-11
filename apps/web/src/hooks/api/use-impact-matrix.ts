import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"

export function useMultiRepoImpactMatrix(runId: string) {
  return useQuery({
    queryKey: [...queryKeys.analyses.runs.detail(runId), "impact-matrix"],
    queryFn: async () => {
      const { multiRepoImpactMatrixResponseSchema } = await import("@ba-helper/contracts")
      return apiGet<import("@ba-helper/contracts").MultiRepoImpactMatrixResponse>(
        `/api/v1/multi-repo-runs/${runId}/impact-matrix`,
        multiRepoImpactMatrixResponseSchema,
      )
    },
    enabled: Boolean(runId),
    refetchOnWindowFocus: true,
  })
}

export function useMatrixRowDetail(runId: string, analysisId: string | null) {
  return useQuery({
    queryKey: ["multi-repo-run", runId, "impact-matrix-row-detail", analysisId],
    queryFn: async () => {
      if (!analysisId) throw new Error("analysisId is required")
      const { matrixRowDetailResponseSchema } = await import("@ba-helper/contracts")
      return apiGet<import("@ba-helper/contracts").MatrixRowDetailResponse>(
        `/api/v1/multi-repo-runs/${runId}/impact-matrix/analyses/${analysisId}/details`,
        matrixRowDetailResponseSchema,
      )
    },
    enabled: Boolean(runId && analysisId),
    refetchOnWindowFocus: false, // Keep data stable while drawer is open
  })
}
