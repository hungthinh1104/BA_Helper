import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import { useOptionalProjectId } from "@/lib/project-context"
import {
  MultiRepoImpactAnalysisCreateRequest,
  MultiRepoImpactAnalysisCreateResponse,
  MultiRepoAnalysisRunDetailResponse,
  MultiRepoAnalysisRunListResponse,
  multiRepoImpactAnalysisCreateResponseSchema,
  multiRepoAnalysisRunDetailResponseSchema,
  multiRepoAnalysisRunListResponseSchema,
} from "@ba-helper/contracts"

export function useCreateMultiRepoAnalyses(projectId?: string) {
  const activeProjectId = useOptionalProjectId()
  const effectiveProjectId = projectId ?? activeProjectId
  const projectQueryKey = effectiveProjectId ?? "__workspace-pending__"
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      requirementRevisionId: string
      repositoryIds: string[]
      allowPartialSnapshot: boolean
      requestKey: string
    }) => {
      if (!effectiveProjectId) {
        throw new Error("No active project selected.")
      }

      const request: MultiRepoImpactAnalysisCreateRequest = {
        requirementRevisionId: data.requirementRevisionId,
        repositoryIds: data.repositoryIds,
        allowPartialSnapshot: data.allowPartialSnapshot,
        requestKey: data.requestKey,
      }

      return apiPost<MultiRepoImpactAnalysisCreateResponse>(
        `/api/v1/projects/${effectiveProjectId}/multi-repo-analyses`,
        request,
        multiRepoImpactAnalysisCreateResponseSchema,
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.list(projectQueryKey),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.all,
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.analyses.runs.list(projectQueryKey),
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

export function useMultiRepoAnalysisRunDetail(runId: string) {
  return useQuery({
    queryKey: queryKeys.analyses.runs.detail(runId),
    queryFn: async () => {
      return apiGet<MultiRepoAnalysisRunDetailResponse>(
        `/api/v1/multi-repo-runs/${runId}`,
        multiRepoAnalysisRunDetailResponseSchema,
      )
    },
    enabled: Boolean(runId),
    refetchOnWindowFocus: true,
  })
}

export function useMultiRepoAnalysisRuns(projectId?: string) {
  const activeProjectId = useOptionalProjectId()
  const effectiveProjectId = projectId ?? activeProjectId

  return useQuery({
    queryKey: queryKeys.analyses.runs.list(
      effectiveProjectId ?? "__workspace-pending__",
    ),
    queryFn: async () => {
      return apiGet<MultiRepoAnalysisRunListResponse>(
        `/api/v1/projects/${effectiveProjectId}/multi-repo-runs`,
        multiRepoAnalysisRunListResponseSchema,
      )
    },
    enabled: Boolean(effectiveProjectId),
    refetchOnWindowFocus: true,
  })
}
