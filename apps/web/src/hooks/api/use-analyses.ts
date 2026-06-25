import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import { canPollAnalysisDetail } from "@/lib/status-helpers"
import { useOptionalProjectId } from "@/lib/project-context"

import { ReviewQueueResponse, reviewQueueResponseSchema } from '@ba-helper/contracts'
import {
  ImpactAnalysisDiffResponse,
  LineageTimelineResponse,
  impactAnalysisDiffResponseSchema,
  lineageTimelineResponseSchema,
} from "@ba-helper/contracts"

import {
  ImpactAnalysisListResponse,
  ImpactAnalysisDetailResponse,
  ImpactAnalysisCreateRequest,
  ImpactAnalysisResponse,
  AnalysisWorkspaceResponse,
  impactAnalysisListResponseSchema,
  impactAnalysisResponseSchema,
  analysisWorkspaceResponseSchema,
  impactGraphResponseSchema, 
  ImpactGraphResponse,
} from "@ba-helper/contracts"


export function useAnalyses(params?: { projectId?: string; limit?: number; offset?: number }) {
  const activeProjectId = useOptionalProjectId()
  const effectiveProjectId = params?.projectId ?? activeProjectId
  const projectQueryKey = effectiveProjectId ?? "__workspace-pending__"
  return useQuery({
    queryKey: queryKeys.analyses.list(projectQueryKey, { limit: params?.limit, offset: params?.offset }),
    queryFn: async () => {
      const url = new URL(`/api/v1/projects/${effectiveProjectId}/analyses`, window.location.origin)
      if (params?.limit) url.searchParams.set('limit', params.limit.toString())
      if (params?.offset) url.searchParams.set('offset', params.offset.toString())
      return apiGet<ImpactAnalysisListResponse>(url.pathname + url.search, impactAnalysisListResponseSchema)
    },
    enabled: Boolean(effectiveProjectId),
    refetchOnWindowFocus: true,
  })
}

export function useAnalysisDetail(analysisId: string) {
  return useQuery({
    queryKey: queryKeys.analyses.detail(analysisId),
    queryFn: async () => {
      return apiGet<ImpactAnalysisDetailResponse>(`/api/v1/impact-analyses/${analysisId}`, impactAnalysisResponseSchema)
    },
    enabled: Boolean(analysisId),
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && canPollAnalysisDetail(data) ? 3000 : false;
    },
  })
}

export function useAnalysisWorkspace(analysisId: string) {
  return useQuery({
    queryKey: queryKeys.analyses.workspace(analysisId),
    queryFn: async () => {
      return apiGet<AnalysisWorkspaceResponse>(
        `/api/v1/impact-analyses/${analysisId}/workspace`,
        analysisWorkspaceResponseSchema,
      )
    },
    enabled: Boolean(analysisId),
    refetchOnWindowFocus: true,
  })
}

export function useCreateAnalysis(projectId?: string) {
  const activeProjectId = useOptionalProjectId()
  const effectiveProjectId = projectId ?? activeProjectId
  const projectQueryKey = effectiveProjectId ?? "__workspace-pending__"
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ revisionId, data }: { revisionId: string, data: ImpactAnalysisCreateRequest }) => {
      return apiPost<ImpactAnalysisResponse>(`/api/v1/requirement-revisions/${revisionId}/impact-analyses`, data, impactAnalysisResponseSchema)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.list(projectQueryKey),
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


export * from "./use-multi-repo-runs"
export * from "./use-impact-matrix"
export * from "./use-insights"
export * from "./use-review-decisions"
export * from "./use-clarifications"
export * from "./use-reports"

export function useAnalysisLineage(analysisId: string) {
  return useQuery({
    queryKey: queryKeys.analyses.lineage(analysisId),
    queryFn: async () => {
      return apiGet<LineageTimelineResponse>(
        `/api/v1/impact-analyses/${analysisId}/lineage`,
        lineageTimelineResponseSchema
      )
    },
    enabled: !!analysisId,
  })
}

export function useAnalysisDriftFreshness(projectId: string | undefined, analysisId: string) {
  return useQuery({
    queryKey: queryKeys.analyses.driftFreshness(analysisId),
    queryFn: async () => {
      const { driftFreshnessRecommendationSchema } = await import("@ba-helper/contracts")
      return apiGet(
        `/api/v1/projects/${projectId}/analyses/${analysisId}/drift-freshness`,
        driftFreshnessRecommendationSchema
      )
    },
    enabled: Boolean(projectId && analysisId),
  })
}

export function useImpactGraph(analysisId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery<ImpactGraphResponse>({
    queryKey: queryKeys.analyses.graph(analysisId ?? ""),
    queryFn: () =>
      apiGet<ImpactGraphResponse>(
        `/api/v1/impact-analyses/${analysisId}/graph`,
        impactGraphResponseSchema,
      ),
    enabled: Boolean(analysisId) && (options?.enabled ?? true),
    staleTime: 30_000,
  })
}

export function useReviewQueue(analysisId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery<ReviewQueueResponse>({
    queryKey: queryKeys.analyses.reviewQueue(analysisId ?? ''),
    queryFn: () =>
      apiGet<ReviewQueueResponse>(
        `/api/v1/impact-analyses/${analysisId}/review-queue`,
        reviewQueueResponseSchema,
      ),
    enabled: Boolean(analysisId) && (options?.enabled ?? true),
  })
}

export function useAnalysisDiff(analysisId: string, enabled: boolean = true) {
  return useQuery<ImpactAnalysisDiffResponse>({
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
