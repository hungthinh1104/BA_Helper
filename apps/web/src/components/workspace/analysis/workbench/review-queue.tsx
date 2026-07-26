"use client"

import { useMemo, useRef } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { SupportedLocale } from "@/lib/i18n/status-labels"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { readAnalysisWorkbenchUrlState, writeAnalysisWorkbenchUrlState } from "./analysis-workbench-url-state"
import { filterReviewItems } from "./analysis-workbench-view-model"
import type { AnalysisWorkbenchViewModel, ReviewFilter } from "./analysis-workbench-types"
import { ReviewEmptyState } from "./review-empty-state"
import { ReviewFilterBar } from "./review-filter-bar"
import { ReviewProgressHeader } from "./review-progress-header"
import { ReviewQueueItem } from "./review-queue-item"

export function ReviewQueue({
  viewModel,
  locale,
  labels,
}: {
  viewModel: AnalysisWorkbenchViewModel
  locale: SupportedLocale
  labels: AnalysisWorkspaceLabels["reviewQueue"]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queueRef = useRef<HTMLDivElement>(null)
  const urlState = readAnalysisWorkbenchUrlState(searchParams ?? new URLSearchParams())
  const items = useMemo(
    () => filterReviewItems(viewModel.orderedReviewItems, urlState.filter),
    [urlState.filter, viewModel.orderedReviewItems],
  )
  const selectedItemId = items.some((item) => item.itemId === viewModel.selectedItemId)
    ? viewModel.selectedItemId
    : items[0]?.itemId ?? null
  const counts = useMemo(() => filterCounts(viewModel), [viewModel])

  const updateUrl = (state: { item?: string | null; filter?: ReviewFilter }) => {
    const params = writeAnalysisWorkbenchUrlState(
      new URLSearchParams(searchParams?.toString() ?? ""),
      { view: "review", ...state },
    )
    const query = params.toString()
    router.push(query ? `${pathname ?? ""}?${query}` : pathname ?? "", { scroll: false })
  }

  const moveSelection = (direction: -1 | 1) => {
    if (items.length === 0) return
    const currentIndex = Math.max(0, items.findIndex((item) => item.itemId === selectedItemId))
    const nextIndex = Math.min(items.length - 1, Math.max(0, currentIndex + direction))
    updateUrl({ item: items[nextIndex]?.itemId ?? null })
  }

  return (
    <section className="rounded-lg border border-border/50 bg-surface" aria-label={labels.title}>
      <ReviewProgressHeader
        pending={viewModel.counts.pending}
        blocking={viewModel.counts.blocking}
        labels={labels}
      />
      <div className="border-b border-border/40 px-4 py-3">
        <ReviewFilterBar
          activeFilter={urlState.filter}
          counts={counts}
          labels={labels}
          onChange={(filter) => {
            const nextItems = filterReviewItems(viewModel.orderedReviewItems, filter)
            const nextItemId = nextItems.some((item) => item.itemId === selectedItemId)
              ? selectedItemId
              : nextItems[0]?.itemId ?? null
            updateUrl({ filter, item: nextItemId })
          }}
        />
      </div>
      {items.length === 0 ? (
        <ReviewEmptyState hasItems={viewModel.orderedReviewItems.length > 0} labels={labels} />
      ) : (
        <div
          ref={queueRef}
          data-review-queue
          className="divide-y divide-border/40"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault()
              moveSelection(1)
            }
            if (event.key === "ArrowUp") {
              event.preventDefault()
              moveSelection(-1)
            }
          }}
        >
          {items.map((item) => (
            <ReviewQueueItem
              key={item.itemId}
              item={item}
              isSelected={item.itemId === selectedItemId}
              locale={locale}
              labels={labels}
              onSelect={() => updateUrl({ item: item.itemId })}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function filterCounts(viewModel: AnalysisWorkbenchViewModel): Record<ReviewFilter, number> {
  return {
    all: viewModel.counts.total,
    blocking: viewModel.counts.blocking,
    pending: viewModel.counts.pending,
    conflicting: viewModel.counts.conflicting,
    needs_more_evidence: viewModel.counts.needsMoreEvidence,
    reviewed: viewModel.counts.reviewed,
  }
}
