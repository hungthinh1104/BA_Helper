import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import {
  artifactListResponseSchema,
  codeComprehensionResponseSchema,
  MAX_ARTIFACT_SEARCH_OFFSET,
  type ArtifactListResponse,
  type CodeComprehensionResponse,
} from "@ba-helper/contracts"
import { apiGet } from "@/lib/api-client"
import { queryKeys } from "@/lib/api/query-keys"

export const ARTIFACT_PAGE_SIZE = 50
export const MAX_ARTIFACT_OFFSET = MAX_ARTIFACT_SEARCH_OFFSET

export function useSnapshotArtifacts(snapshotId: string | undefined, enabled = true, search = "") {
  return useInfiniteQuery({
    queryKey: queryKeys.repositories.snapshotArtifacts(snapshotId ?? "", search),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ scope: "production", limit: String(ARTIFACT_PAGE_SIZE), offset: String(pageParam) })
      if (search) params.set("search", search)
      return apiGet<ArtifactListResponse>(
        `/api/v1/snapshots/${encodeURIComponent(snapshotId ?? "")}/artifacts?${params}`, artifactListResponseSchema,
      )
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = (lastPage.offset ?? 0) + (lastPage.limit ?? ARTIFACT_PAGE_SIZE)
      return lastPage.hasMore && nextOffset <= MAX_ARTIFACT_OFFSET ? nextOffset : undefined
    },
    enabled: Boolean(snapshotId && enabled),
    retry: false,
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
