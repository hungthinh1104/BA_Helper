"use client"

import { Button } from "@/components/ui/button"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import type { ReviewFilter } from "./analysis-workbench-types"

const filters: ReviewFilter[] = [
  "all",
  "blocking",
  "pending",
  "conflicting",
  "needs_more_evidence",
  "reviewed",
]

export function ReviewFilterBar({
  activeFilter,
  counts,
  labels,
  onChange,
}: {
  activeFilter: ReviewFilter
  counts: Record<ReviewFilter, number>
  labels: AnalysisWorkspaceLabels["reviewQueue"]
  onChange: (filter: ReviewFilter) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar" aria-label={labels.filterLabel}>
      {filters.map((filter) => (
        <Button
          key={filter}
          type="button"
          size="sm"
          variant={activeFilter === filter ? "secondary" : "outline"}
          aria-pressed={activeFilter === filter}
          onClick={() => onChange(filter)}
        >
          {labels.filters[filter]} <span className="tabular-nums text-muted-foreground">{counts[filter]}</span>
        </Button>
      ))}
    </div>
  )
}
