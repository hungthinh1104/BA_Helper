import { useQuery } from "@tanstack/react-query"
import {
  artifactListResponseSchema,
  codeComprehensionResponseSchema,
  type ArtifactListResponse,
  type CodeComprehensionResponse,
} from "@ba-helper/contracts"
import { apiGet } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"

export function useSnapshotArtifacts(snapshotId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.repositories.snapshotArtifacts(snapshotId ?? ""),
    queryFn: () => apiGet<ArtifactListResponse>(
      `/api/v1/snapshots/${encodeURIComponent(snapshotId ?? "")}/artifacts?scope=production&limit=50&offset=0`, artifactListResponseSchema,
    ),
    enabled: Boolean(snapshotId && enabled),
    staleTime: 60_000,
  })
}

export function useCodeComprehension(snapshotId: string | undefined, artifactId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.repositories.artifactComprehension(snapshotId ?? "", artifactId ?? ""),
    queryFn: () => apiGet<CodeComprehensionResponse>(
      `/api/v1/snapshots/${encodeURIComponent(snapshotId ?? "")}/artifacts/${encodeURIComponent(artifactId ?? "")}/comprehension`,
      codeComprehensionResponseSchema,
    ),
    enabled: Boolean(snapshotId && artifactId),
    retry: false,
    staleTime: 60_000,
  })
}
