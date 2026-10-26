"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { FileCode2, Loader2, SearchX } from "lucide-react"
import { useLocalizedHref } from "@/i18n/navigation"
import { MAX_ARTIFACT_OFFSET, useSnapshotArtifacts } from "@/hooks/api/use-code-comprehension"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const PRODUCTION_TYPES = new Set(["CONTROLLER", "API_ROUTE", "SERVICE", "SERVICE_METHOD", "ENTITY"])
type NavigatorArtifact = { id: string; name: string; filePath: string; startLine: number | null; artifactType: string }

function ArtifactResults(props: {
  repositoryId: string
  snapshotId?: string
  href: ReturnType<typeof useLocalizedHref>
  artifacts: NavigatorArtifact[]
  loading: boolean
  error: boolean
  loadMoreError: boolean
  searchPending: boolean
  search: string
  hasNextPage: boolean
  fetchingNextPage: boolean
  reachedLimit: boolean
  onRetry: () => void
  onLoadMore: () => void
}) {
  const { repositoryId, snapshotId, href, artifacts, loading, error, loadMoreError, searchPending, search,
    hasNextPage, fetchingNextPage, reachedLimit, onRetry, onLoadMore } = props

  return (
    <>
      {snapshotId && (loading || searchPending) && (
        <div className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading production artifacts…</div>
      )}
      {snapshotId && error && !searchPending && (
        <div className="mt-4 flex items-center gap-2 text-[12px] text-danger">
          <span>The artifact index could not be loaded. Snapshot permissions or availability may have changed.</span>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>Retry</Button>
        </div>
      )}
      {snapshotId && !loading && !error && !searchPending && artifacts.length === 0 && (
        <div className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground"><SearchX className="h-3.5 w-3.5" /> {search ? "No production artifacts match this search." : "No supported production artifacts were indexed."}</div>
      )}
      {snapshotId && !searchPending && artifacts.length > 0 && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {artifacts.map((artifact) => (
            <li key={artifact.id}>
              <Link
                href={href(`/repositories/${repositoryId}/snapshots/${snapshotId}/artifacts/${artifact.id}`)}
                className="block rounded-lg border border-border/50 bg-background/40 px-3 py-2 transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <span className="block truncate text-[13px] font-medium text-foreground">{artifact.name}</span>
                <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
                  {artifact.filePath}:{artifact.startLine ?? "?"} · {artifact.artifactType}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!error && !searchPending && hasNextPage && !loadMoreError && (
        <Button type="button" size="sm" variant="outline" className="mt-4" disabled={fetchingNextPage} onClick={onLoadMore}>
          {fetchingNextPage ? "Loading more…" : "Load more"}
        </Button>
      )}
      {!searchPending && loadMoreError && hasNextPage && (
        <div className="mt-4 flex items-center gap-2 text-[12px] text-danger">
          <span>The next artifact page could not be loaded.</span>
          <Button type="button" size="sm" variant="outline" disabled={fetchingNextPage} onClick={onLoadMore}>
            {fetchingNextPage ? "Loading more..." : "Retry loading more"}
          </Button>
        </div>
      )}
      {!error && !searchPending && reachedLimit && (
        <p className="mt-4 text-[12px] text-muted-foreground">The browsing limit was reached. Search by method, artifact key, or file path to find more artifacts.</p>
      )}
    </>
  )
}

export function CodeEvidenceNavigator({ repositoryId, snapshotId }: { repositoryId: string; snapshotId?: string }) {
  const href = useLocalizedHref()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 200)
    return () => window.clearTimeout(timer)
  }, [search])

  const query = useSnapshotArtifacts(snapshotId, open, debouncedSearch)
  const artifacts = useMemo(() => query.data?.pages.flatMap((page) => page.items.filter(
    (item) => PRODUCTION_TYPES.has(item.artifactType),
  )) ?? [], [query.data])
  const lastPage = query.data?.pages.at(-1)
  const reachedLimit = Boolean(lastPage?.limitReached || lastPage?.hasMore && !query.hasNextPage &&
    (lastPage.offset ?? 0) + (lastPage.limit ?? 50) > MAX_ARTIFACT_OFFSET)
  const searchPending = search.trim() !== debouncedSearch

  return (
    <section className="rounded-xl border border-border/40 bg-surface/50 p-5 shadow-sm" aria-label="Code evidence">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button type="button" aria-expanded={open} aria-controls="code-evidence-content" onClick={() => setOpen(value => !value)} className="text-left text-[15px] font-semibold text-foreground hover:text-primary">Code evidence</button>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Browse persisted source, static call paths, and related Jest declarations from the selected snapshot.
          </p>
        </div>
        <FileCode2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
      {!snapshotId && (
        <p className="mt-4 text-[12px] text-muted-foreground">A usable snapshot is required before code evidence can be opened.</p>
      )}
      {snapshotId && !open && (
        <p className="mt-4 text-[12px] text-muted-foreground">Open this panel to load the bounded artifact index.</p>
      )}
      {open && <div id="code-evidence-content">
        {snapshotId && <Input
          aria-label="Search method, artifact key, or file path"
          placeholder="Search method, artifact key, or file path"
          maxLength={120}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="mt-4"
        />}
        <ArtifactResults
          repositoryId={repositoryId}
          snapshotId={snapshotId}
          href={href}
          artifacts={artifacts}
          loading={query.isLoading}
          error={query.isError && !query.isFetchNextPageError}
          loadMoreError={query.isFetchNextPageError}
          searchPending={searchPending}
          search={debouncedSearch}
          hasNextPage={Boolean(query.hasNextPage)}
          fetchingNextPage={query.isFetchingNextPage}
          reachedLimit={reachedLimit}
          onRetry={() => { void query.refetch() }}
          onLoadMore={() => { void query.fetchNextPage() }}
        />
      </div>}
    </section>
  )
}
