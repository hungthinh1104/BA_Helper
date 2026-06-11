import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import {
  ImpactAnalysisListResponse,
  ImpactAnalysisDetailResponse,
  ImpactAnalysisCreateRequest,
  ImpactAnalysisResponse,
  InsightListResponse,
  TraceabilityLinkListResponse,
  InsightReviewRequest,
  impactAnalysisListResponseSchema,
  impactAnalysisResponseSchema,
  insightListResponseSchema,
  traceabilityLinkListResponseSchema
} from "@ba-helper/contracts"

import { canPollAnalysisDetail } from "@/lib/status-helpers"

export function useAnalyses(projectId: string = "default-project") {
  return useQuery({
    queryKey: queryKeys.analyses.list(projectId),
    queryFn: async () => {
      return apiGet<ImpactAnalysisListResponse>(`/api/v1/projects/${projectId}/analyses`, impactAnalysisListResponseSchema)
    },
    enabled: Boolean(projectId),
    refetchOnWindowFocus: true,
  })
}

export function useAnalysisDetail(projectId: string = "default-project", analysisId: string) {
  return useQuery({
    queryKey: queryKeys.analyses.detail(analysisId),
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return apiGet<ImpactAnalysisDetailResponse>(`/api/v1/projects/${projectId}/analyses/${analysisId}`, impactAnalysisResponseSchema as any)
    },
    enabled: Boolean(analysisId),
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && canPollAnalysisDetail(data) ? 3000 : false;
    },
  })
}

export function useCreateAnalysis(projectId: string = "default-project") {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: ImpactAnalysisCreateRequest) => {
      return apiPost<ImpactAnalysisResponse>(`/api/v1/projects/${projectId}/analyses`, input, impactAnalysisResponseSchema)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.list(projectId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.requirements.all,
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.repositories.all,
      })
    },
  })
}

export function useAnalysisInsights(projectId: string = "default-project", analysisId: string) {
  return useQuery({
    queryKey: [...queryKeys.analyses.detail(analysisId), "insights"],
    queryFn: async () => {
      return apiGet<InsightListResponse>(`/api/v1/projects/${projectId}/analyses/${analysisId}/insights`, insightListResponseSchema)
    },
    enabled: Boolean(analysisId),
  })
}

export function useAnalysisTraceability(projectId: string = "default-project", analysisId: string) {
  return useQuery({
    queryKey: [...queryKeys.analyses.detail(analysisId), "traceability"],
    queryFn: async () => {
      return apiGet<TraceabilityLinkListResponse>(`/api/v1/projects/${projectId}/analyses/${analysisId}/traceability`, traceabilityLinkListResponseSchema)
    },
    enabled: Boolean(analysisId),
  })
}

export function useReviewInsight(projectId: string = "default-project", analysisId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ insightId, data }: { insightId: string, data: InsightReviewRequest }) => {
      return apiPost(`/api/v1/projects/${projectId}/analyses/${analysisId}/insights/${insightId}/review`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.analyses.detail(analysisId), "insights"],
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.detail(analysisId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.list(projectId),
      })
    }
  })
}

export function useFinalizeAnalysis(projectId: string = "default-project", analysisId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      return apiPost(`/api/v1/projects/${projectId}/analyses/${analysisId}/finalize`, {})
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.detail(analysisId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.list(projectId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.report(analysisId),
      })
    }
  })
}
