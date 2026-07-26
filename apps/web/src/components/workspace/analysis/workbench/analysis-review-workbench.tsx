"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import type { SupportedLocale } from "@/lib/i18n/status-labels"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { Button } from "@/components/ui/button"
import { useImpactGraph } from "@/hooks/api/use-analyses"
import {
  decisionRequiresRationale,
  useReviewItemDecision,
  type ReviewDecisionAction,
} from "@/hooks/api/use-review-item-decision"
import { GraphTab } from "../graph-tab"
import { readAnalysisWorkbenchUrlState, writeAnalysisWorkbenchUrlState } from "./analysis-workbench-url-state"
import { filterReviewItems } from "./analysis-workbench-view-model"
import type { AnalysisWorkbenchViewModel, ReviewDisplay } from "./analysis-workbench-types"
import { DecisionPanel } from "./decision-panel"
import { MobileEvidenceSheet } from "./mobile-evidence-sheet"
import { ReviewItemDetail } from "./review-item-detail"
import { ReviewQueue } from "./review-queue"

export function AnalysisReviewWorkbench({
  workspace,
  viewModel,
  locale,
  labels,
  queueLabels,
  graphLabels,
}: {
  workspace: AnalysisWorkspaceResponse
  viewModel: AnalysisWorkbenchViewModel
  locale: SupportedLocale
  labels: AnalysisWorkspaceLabels["reviewWorkbench"]
  queueLabels: AnalysisWorkspaceLabels["reviewQueue"]
  graphLabels: AnalysisWorkspaceLabels["graph"]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlState = readAnalysisWorkbenchUrlState(searchParams ?? new URLSearchParams())
  const visibleItems = useMemo(
    () => filterReviewItems(viewModel.orderedReviewItems, urlState.filter),
    [urlState.filter, viewModel.orderedReviewItems],
  )
  const selectedIndex = visibleItems.findIndex((item) => item.itemId === viewModel.selectedItemId)
  const selectedItem = selectedIndex >= 0 ? visibleItems[selectedIndex] : visibleItems[0] ?? null

  const decision = useReviewItemDecision(workspace.overview.analysisId)
  const [rationale, setRationale] = useState("")
  const [lastAction, setLastAction] = useState<ReviewDecisionAction | null>(null)

  const { data: graph, isLoading: graphLoading } = useImpactGraph(workspace.overview.analysisId, {
    enabled: urlState.display === "dependency-path",
  })

  // A fresh item means a fresh rationale draft — reset during render on change
  // (React's recommended alternative to a reset effect).
  const currentItemId = selectedItem?.itemId ?? null
  const [trackedItemId, setTrackedItemId] = useState(currentItemId)
  if (currentItemId !== trackedItemId) {
    setTrackedItemId(currentItemId)
    setRationale("")
    setLastAction(null)
  }

  const pushUrl = (state: { item?: string | null; display?: ReviewDisplay }) => {
    const params = writeAnalysisWorkbenchUrlState(
      new URLSearchParams(searchParams?.toString() ?? ""),
      { view: "review", ...state },
    )
    const query = params.toString()
    router.push(query ? `${pathname ?? ""}?${query}` : pathname ?? "", { scroll: false })
  }

  const navigate = (direction: -1 | 1) => {
    if (visibleItems.length === 0) return
    const from = selectedIndex >= 0 ? selectedIndex : 0
    const nextIndex = Math.min(visibleItems.length - 1, Math.max(0, from + direction))
    pushUrl({ item: visibleItems[nextIndex]?.itemId ?? null })
  }

  const handleDecide = (action: ReviewDecisionAction) => {
    if (!selectedItem || decision.isPending) return
    if (decisionRequiresRationale(action) && rationale.trim().length === 0) return
    setLastAction(action)
    const from = selectedIndex >= 0 ? selectedIndex : 0
    const nextId = visibleItems[from + 1]?.itemId ?? visibleItems[from - 1]?.itemId ?? null
    decision.decide(
      { item: { itemId: selectedItem.itemId, itemType: selectedItem.itemType }, action, rationale },
      {
        onSuccess: () => {
          setRationale("")
          // Undo keeps the reviewer on the item; a decision advances them.
          if (action !== "undo" && nextId) pushUrl({ item: nextId })
        },
      },
    )
  }

  // Global keyboard shortcuts for the decision loop. A ref keeps the listener
  // bound once while always seeing the latest selection/rationale.
  const actionsRef = useRef({ handleDecide, navigate })
  useEffect(() => {
    actionsRef.current = { handleDecide, navigate }
  })
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable)
      ) {
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const map: Record<string, () => void> = {
        a: () => actionsRef.current.handleDecide("accept"),
        r: () => actionsRef.current.handleDecide("reject"),
        e: () => actionsRef.current.handleDecide("needs_more_evidence"),
        u: () => actionsRef.current.handleDecide("undo"),
        j: () => actionsRef.current.navigate(1),
        k: () => actionsRef.current.navigate(-1),
      }
      const run = map[event.key.toLowerCase()]
      if (run) {
        event.preventDefault()
        run()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const detail = <ReviewItemDetail workspace={workspace} viewModel={viewModel} item={selectedItem} locale={locale} labels={labels} />

  return (
    <div data-review-workbench>
      <section className="grid min-h-0 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_280px]">
        <ReviewQueue viewModel={viewModel} locale={locale} labels={queueLabels} />
        <div className="min-w-0 rounded-lg border border-border/50 bg-surface p-4">
          <div className="mb-4 hidden gap-2 lg:flex" role="group" aria-label={labels.reviewDetail}>
            <Button type="button" size="sm" variant={urlState.display === "evidence" ? "secondary" : "outline"} aria-pressed={urlState.display === "evidence"} onClick={() => pushUrl({ display: "evidence" })}>
              {labels.evidence}
            </Button>
            <Button type="button" size="sm" variant={urlState.display === "dependency-path" ? "secondary" : "outline"} aria-pressed={urlState.display === "dependency-path"} onClick={() => pushUrl({ display: "dependency-path" })}>
              {labels.dependencyPath}
            </Button>
          </div>
          {/* Mobile shows the detail only inside the sheet — never duplicated inline. */}
          <div className="lg:hidden"><MobileEvidenceSheet labels={labels}>{detail}</MobileEvidenceSheet></div>
          <div className="hidden lg:block">
            {urlState.display === "dependency-path" ? <GraphTab graph={graph} isLoading={graphLoading} labels={graphLabels} /> : detail}
          </div>
        </div>
        <DecisionPanel
          item={selectedItem}
          locale={locale}
          labels={labels.decision}
          rationale={rationale}
          onRationaleChange={setRationale}
          onDecide={handleDecide}
          onNavigate={navigate}
          onRetry={() => lastAction && handleDecide(lastAction)}
          isPending={decision.isPending}
          hasError={Boolean(decision.error)}
          canPrevious={selectedIndex > 0}
          canNext={selectedIndex >= 0 && selectedIndex < visibleItems.length - 1}
        />
      </section>

      {/* Sticky decision action bar for the mobile single-pane flow. */}
      {selectedItem ? (
        <div
          className="sticky bottom-2 z-10 mt-3 flex gap-2 rounded-lg border border-border/50 bg-surface/95 p-2 shadow-lg backdrop-blur lg:hidden"
          data-mobile-action-bar
        >
          <Button type="button" size="sm" variant="secondary" className="flex-1" disabled={decision.isPending} onClick={() => handleDecide("accept")}>
            {labels.decision.accept}
          </Button>
          <Button type="button" size="sm" variant="destructive" className="flex-1" disabled={decision.isPending || rationale.trim().length === 0} onClick={() => handleDecide("reject")}>
            {labels.decision.reject}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
