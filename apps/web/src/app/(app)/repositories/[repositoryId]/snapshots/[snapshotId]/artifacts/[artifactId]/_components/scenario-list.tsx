import { Clock3 } from "lucide-react"
import type { CodeComprehensionResponse, ComprehensionScenario } from "@ba-helper/contracts"
import { Scenario, ScenarioComparison, type TracePresentation } from "./scenario-inspector"

type SnapshotEvidenceContext = Pick<CodeComprehensionResponse["snapshotContext"], "snapshotId" | "commitSha">

export function ScenarioList({ scenarios, snapshotContext, pagination, limitations, hasNextPage, isFetchingNextPage, isFetchNextPageError, onLoadMore, tracePresentation }: {
  scenarios: ComprehensionScenario[]
  snapshotContext: SnapshotEvidenceContext
  pagination: CodeComprehensionResponse["scenarioPagination"]
  limitations: CodeComprehensionResponse["limitations"]
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isFetchNextPageError: boolean
  onLoadMore: () => void
  tracePresentation: TracePresentation
}) {
  const reachedScenarioLimit = limitations.some((item) => item.code === "SCENARIO_OFFSET_LIMIT")
  const canLoadMore = hasNextPage && pagination.hasMore
  return (
    <section className="rounded-xl border border-border/40 bg-surface/50 p-4 shadow-sm" aria-labelledby="scenario-title">
      <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-muted-foreground" /><h2 id="scenario-title" className="text-[14px] font-semibold">Related Jest scenarios</h2></div>
      <p className="mt-1 text-[12px] text-muted-foreground">Declarations are shown with their exact static source claims. No execution or coverage is inferred.</p>
      {scenarios.length === 0 ? <p className="mt-4 text-[12px] text-muted-foreground">No supported test-to-code reference was persisted. This does not prove that no tests exist; inspect the scan limitations above.</p> : <div id="related-scenarios-list" className="mt-3 space-y-2">{scenarios.map((scenario) => <Scenario key={scenario.testArtifact.id} scenario={scenario} snapshotContext={snapshotContext} tracePresentation={tracePresentation} />)}</div>}
      <p role="status" aria-live="polite" className="mt-2 text-[11px] text-muted-foreground">
        Showing {scenarios.length} currently loaded related scenario{scenarios.length === 1 ? "" : "s"}.
      </p>
      {canLoadMore && !isFetchNextPageError && <button type="button" aria-controls="related-scenarios-list" aria-busy={isFetchingNextPage} disabled={isFetchingNextPage} onClick={onLoadMore} className="mt-3 rounded border border-border/50 px-3 py-2 text-[12px] font-medium hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-wait disabled:opacity-60">{isFetchingNextPage ? "Loading more scenarios..." : "Load more scenarios"}</button>}
      {isFetchNextPageError && <div role={isFetchingNextPage ? "status" : "alert"} aria-live="polite" className="mt-3 rounded border border-danger/30 bg-danger/5 px-3 py-2 text-[11px]">{isFetchingNextPage ? "Retrying the next scenario page..." : "More scenarios could not be loaded. Retry to continue."}</div>}
      {isFetchNextPageError && <button type="button" disabled={isFetchingNextPage} aria-busy={isFetchingNextPage} onClick={onLoadMore} className="mt-2 rounded border border-border/50 px-3 py-2 text-[12px] font-medium hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-wait disabled:opacity-60">{isFetchingNextPage ? "Retrying scenarios..." : "Retry loading scenarios"}</button>}
      {!canLoadMore && reachedScenarioLimit && <p role="status" className="mt-3 rounded border border-warning/30 bg-warning/5 px-2 py-1.5 text-[11px] text-warning">The API retrieval limit was reached. More source-linked scenarios exist beyond the available pages.</p>}
      {scenarios.length > 1 && <ScenarioComparison scenarios={scenarios} />}
    </section>
  )
}
