import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"
import { 
  RepositorySnapshotDriftResponse, 
  repositorySnapshotDriftResponseSchema 
} from "@ba-helper/contracts"

export function useRepositorySnapshotDrift(
  projectId: string | undefined, 
  repositoryId: string | undefined, 
  baseSnapshotId: string | undefined,
  targetSnapshotId?: string
) {
  return useQuery({
    queryKey: queryKeys.repositories.snapshotDrift(repositoryId || "", baseSnapshotId || "", targetSnapshotId),
    queryFn: async () => {
      const url = new URL(`/api/v1/projects/${projectId}/repositories/${repositoryId}/snapshots/${baseSnapshotId}/drift`, window.location.origin)
      if (targetSnapshotId) {
        url.searchParams.set('targetSnapshotId', targetSnapshotId)
      }
      return apiGet<RepositorySnapshotDriftResponse>(url.pathname + url.search, repositorySnapshotDriftResponseSchema)
    },
    enabled: Boolean(projectId && repositoryId && baseSnapshotId),
    refetchOnWindowFocus: false,
  })
}
