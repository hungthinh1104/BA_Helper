import { useInfiniteQuery } from "@tanstack/react-query"
import {
  artifactListResponseSchema,
  codeComprehensionResponseSchema,
  MAX_ARTIFACT_SEARCH_OFFSET,
  type ArtifactListResponse,
  type CodeComprehensionResponse,
  type ComprehensionScenario,
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

export function useCodeComprehension(snapshotId: string | undefined, artifactId: string | undefined, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.repositories.artifactComprehension(snapshotId ?? "", artifactId ?? ""),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ scenarioLimit: "50", scenarioOffset: String(pageParam) })
      return apiGet<CodeComprehensionResponse>(
      `/api/v1/snapshots/${encodeURIComponent(snapshotId ?? "")}/artifacts/${encodeURIComponent(artifactId ?? "")}/comprehension?${params}`,
      codeComprehensionResponseSchema,
      )
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.scenarioPagination.hasMore
      ? lastPage.scenarioPagination.offset + lastPage.scenarioPagination.limit
      : undefined,
    enabled: Boolean(snapshotId && artifactId && enabled),
    retry: false,
    staleTime: 60_000,
  })
}

export function mergeComprehensionPages(pages: readonly CodeComprehensionResponse[]): CodeComprehensionResponse | undefined {
  const firstPage = pages[0]
  const lastPage = pages[pages.length - 1]
  if (!firstPage || !lastPage) return undefined

  const limitations = new Map<string, CodeComprehensionResponse["limitations"][number]>()
  for (const page of pages) {
    for (const limitation of page.limitations) {
      limitations.set(`${limitation.code}:${limitation.message}`, limitation)
    }
  }

  return {
    ...firstPage,
    relatedScenarios: mergeScenarioPages(pages.map((page) => page.relatedScenarios)),
    scenarioPagination: lastPage.scenarioPagination,
    limitations: [...limitations.values()],
    truncated: pages.some((page) => page.truncated),
  }
}

export function mergeScenarioPages(pages: readonly ComprehensionScenario[][]): ComprehensionScenario[] {
  const scenarios = new Map<string, ComprehensionScenario>()
  for (const page of pages) {
    for (const scenario of page) {
      if (!scenarios.has(scenario.testArtifact.id)) scenarios.set(scenario.testArtifact.id, scenario)
    }
  }
  return [...scenarios.values()]
}
