"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { evidenceBasisLabels, getLocalizedLabel, reviewDecisionLabels, type SupportedLocale } from "@/lib/i18n/status-labels"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import type { ReviewWorkbenchItem } from "./analysis-workbench-types"

export function ReviewQueueItem({
  item,
  isSelected,
  locale,
  labels,
  onSelect,
}: {
  item: ReviewWorkbenchItem
  isSelected: boolean
  locale: SupportedLocale
  labels: AnalysisWorkspaceLabels["reviewQueue"]
  onSelect: () => void
}) {
  const basis = item.impactBasis
  const decision = getLocalizedLabel(reviewDecisionLabels, item.currentDecision, locale)

  return (
    <button
      type="button"
      className={cn(
        "w-full border-l-2 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        isSelected
          ? "border-primary bg-primary/8"
          : "border-transparent hover:bg-surface-muted/50",
      )}
      aria-current={isSelected ? "true" : undefined}
      aria-label={labels.itemAriaLabel
        .replace("{title}", item.title)
        .replace("{type}", item.itemType)
        .replace("{decision}", decision)
        .replace("{blocker}", item.blockingFinalize ? labels.blocking : labels.notBlocking)}
      title={item.itemId}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.itemType}</p>
        </div>
        {item.blockingFinalize ? <Badge variant="destructive">{labels.blocking}</Badge> : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">{decision}</Badge>
        <Badge variant="outline">{labels.evidenceCount.replace("{count}", String(item.evidenceCount))}</Badge>
        <Badge variant="outline">{labels.artifactCount.replace("{count}", String(item.linkedArtifactKeys.length))}</Badge>
        {basis ? <Badge variant="outline">{getLocalizedLabel(evidenceBasisLabels, basis, locale)}</Badge> : null}
      </div>
    </button>
  )
}
