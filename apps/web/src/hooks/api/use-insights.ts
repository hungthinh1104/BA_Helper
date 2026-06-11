import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import { useOptionalProjectId } from "@/lib/project-context"
import {
  InsightListResponse,
  TraceabilityLinkListResponse,
  InsightReviewRequest,
  TraceabilityReviewRequest,
  insightListResponseSchema,
  traceabilityLinkListResponseSchema,
} from "@ba-helper/contracts"

export function useAnalysisInsights(_projectId: string | undefined, analysisId: string) {
  return useQuery({
    queryKey: [...queryKeys.analyses.detail(analysisId), "insights"],
    queryFn: async () => {
      return apiGet<InsightListResponse>(`/api/v1/impact-analyses/${analysisId}/insights`, insightListResponseSchema)
    },
    enabled: Boolean(analysisId),
  })
}

export function useAnalysisTraceability(_projectId: string | undefined, analysisId: string) {
  return useQuery({
    queryKey: [...queryKeys.analyses.detail(analysisId), "traceability"],
    queryFn: async () => {
      return apiGet<TraceabilityLinkListResponse>(`/api/v1/impact-analyses/${analysisId}/traceability`, traceabilityLinkListResponseSchema)
    },
    enabled: Boolean(analysisId),
  })
}

export function useReviewInsight(projectId: string | undefined, analysisId: string) {
  const activeProjectId = useOptionalProjectId()
  const effectiveProjectId = projectId ?? activeProjectId
  const projectQueryKey = effectiveProjectId ?? "__workspace-pending__"
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ insightId, data }: { insightId: string, data: InsightReviewRequest }) => {
      return apiPost(`/api/v1/insights/${insightId}/review`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.analyses.detail(analysisId), "insights"],
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.detail(analysisId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.list(projectQueryKey),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.reviewQueue(analysisId),
      })
    }
  })
}

export function useReviewTraceabilityLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ traceabilityLinkId, data }: { traceabilityLinkId: string, data: TraceabilityReviewRequest }) => {
      return apiPost(`/api/v1/traceability-links/${traceabilityLinkId}/review`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.all,
      })
    }
  })
}
