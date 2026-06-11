import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import { RepositorySnapshotListResponse, repositorySnapshotListResponseSchema } from "@ba-helper/contracts"
import { useOptionalProjectId } from "@/lib/project-context"

export function useRepositorySnapshots(projectId: string | undefined, repositoryId: string, params?: { limit?: number }) {
  const activeProjectId = useOptionalProjectId()
  const effectiveProjectId = projectId ?? activeProjectId

  return useQuery({
    queryKey: queryKeys.repositories.snapshots(repositoryId, params),
    queryFn: async () => {
      const url = new URL(`/api/v1/projects/${effectiveProjectId}/repositories/${repositoryId}/snapshots`, window.location.origin)
      if (params?.limit) url.searchParams.set('limit', params.limit.toString())
      return apiGet<RepositorySnapshotListResponse>(url.pathname + url.search, repositorySnapshotListResponseSchema)
    },
    enabled: Boolean(repositoryId && effectiveProjectId),
  })
}
