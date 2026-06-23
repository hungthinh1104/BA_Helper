import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import {
  RepositoryListResponse,
  RepositoryDetailResponse,
  RepositoryCreateRequest,
  RepositoryCreateResponse,
  repositoryListResponseSchema,
  repositoryDetailResponseSchema,
  repositoryCreateResponseSchema
} from "@ba-helper/contracts"

import { canPollRepositoryDetail } from "@/lib/status-helpers"
import { useOptionalProjectId } from "@/lib/project-context"

export function useRepositories(params?: { projectId?: string; limit?: number; offset?: number }) {
  const activeProjectId = useOptionalProjectId()
  const effectiveProjectId = params?.projectId ?? activeProjectId
  const projectQueryKey = effectiveProjectId ?? "__workspace-pending__"
  return useQuery({
    queryKey: queryKeys.repositories.list(projectQueryKey, { limit: params?.limit, offset: params?.offset }),
    queryFn: async () => {
      const url = new URL(`/api/v1/projects/${effectiveProjectId}/repositories`, window.location.origin)
      if (params?.limit) url.searchParams.set('limit', params.limit.toString())
      if (params?.offset) url.searchParams.set('offset', params.offset.toString())
      return apiGet<RepositoryListResponse>(url.pathname + url.search, repositoryListResponseSchema)
    },
    enabled: Boolean(effectiveProjectId),
    refetchOnWindowFocus: true,
  })
}

export function useRepositoryDetail(projectId: string | undefined, repositoryId: string) {
  const activeProjectId = useOptionalProjectId()
  const effectiveProjectId = projectId ?? activeProjectId
  return useQuery({
    queryKey: queryKeys.repositories.detail(repositoryId),
    queryFn: async () => {
      return apiGet<RepositoryDetailResponse>(`/api/v1/projects/${effectiveProjectId}/repositories/${repositoryId}`, repositoryDetailResponseSchema)
    },
    enabled: Boolean(repositoryId && effectiveProjectId),
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && canPollRepositoryDetail(data) ? 3000 : false;
    },
  })
}

export function useCreateRepository(projectId?: string) {
  const activeProjectId = useOptionalProjectId()
  const effectiveProjectId = projectId ?? activeProjectId
  const projectQueryKey = effectiveProjectId ?? "__workspace-pending__"
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RepositoryCreateRequest) => {
      if (!effectiveProjectId) {
        throw new Error("Workspace project is not ready.")
      }
      return apiPost<RepositoryCreateResponse>(`/api/v1/projects/${effectiveProjectId}/repositories`, input, repositoryCreateResponseSchema)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.repositories.list(projectQueryKey),
      })
    },
  })
}

export function useSnapshotDrift(
  projectId: string | undefined,
  repositoryId: string | undefined,
  baseSnapshotId: string | undefined,
  targetCommitSha?: string,
  options?: { enabled?: boolean }
) {
  const activeProjectId = useOptionalProjectId()
  const effectiveProjectId = projectId ?? activeProjectId

  const isEnabled = Boolean(
    effectiveProjectId &&
    repositoryId &&
    baseSnapshotId &&
    (options?.enabled ?? true)
  )

  return useQuery({
    queryKey: [
      ...queryKeys.repositories.detail(repositoryId ?? ''),
      "snapshots",
      baseSnapshotId,
      "drift",
      targetCommitSha,
    ],
    queryFn: async () => {
      const url = new URL(
        `/api/v1/projects/${effectiveProjectId}/repositories/${repositoryId}/snapshots/${baseSnapshotId}/drift`,
        window.location.origin
      )
      if (targetCommitSha) {
        url.searchParams.set('targetCommitSha', targetCommitSha)
      }

      const { repositorySnapshotDriftResponseSchema } = await import("@ba-helper/contracts")
      return apiGet(url.pathname + url.search, repositorySnapshotDriftResponseSchema)
    },
    enabled: isEnabled,
  })
}
