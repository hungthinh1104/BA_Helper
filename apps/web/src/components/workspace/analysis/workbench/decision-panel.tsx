"use client"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { getLocalizedLabel, reviewDecisionLabels, type SupportedLocale } from "@/lib/i18n/status-labels"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import {
  supportedDecisionActions,
  type ReviewDecisionAction,
} from "@/hooks/api/use-review-item-decision"
import type { ReviewWorkbenchItem } from "./analysis-workbench-types"

type DecisionLabels = AnalysisWorkspaceLabels["reviewWorkbench"]["decision"]

/**
 * The single decision surface. It is fully controlled by the workbench so
 * keyboard shortcuts, the rationale draft, and auto-advance all share one state.
 */
export function DecisionPanel({
  item,
  locale,
  labels,
  rationale,
  onRationaleChange,
  onDecide,
  onNavigate,
  onRetry,
  isPending,
  hasError,
  canPrevious,
  canNext,
}: {
  item: ReviewWorkbenchItem | null
  locale: SupportedLocale
  labels: DecisionLabels
  rationale: string
  onRationaleChange: (value: string) => void
  onDecide: (action: ReviewDecisionAction) => void
  onNavigate: (direction: -1 | 1) => void
  onRetry: () => void
  isPending: boolean
  hasError: boolean
  canPrevious: boolean
  canNext: boolean
}) {
  const actions = item ? supportedDecisionActions(item.itemType) : []
  const hasDecision = Boolean(item && item.currentDecision !== "needs_review")
  const rationaleMissing = rationale.trim().length === 0

  return (
    <aside
      className="flex flex-col gap-4 rounded-lg border border-border/50 bg-surface p-4"
      aria-label={labels.title}
      data-decision-panel
    >
      <div>
        <h2 className="text-sm font-semibold text-foreground">{labels.title}</h2>
        {item ? (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{labels.currentStatus}</span>
            <Badge variant={badgeVariant(item.currentDecision)}>
              {getLocalizedLabel(reviewDecisionLabels, item.currentDecision, locale)}
            </Badge>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{labels.noSelection}</p>
        )}
      </div>

      {item ? (
        <>
          <div>
            <label htmlFor="decision-rationale" className="text-xs font-medium text-foreground">
              {labels.rationaleLabel}
            </label>
            <Textarea
              id="decision-rationale"
              value={rationale}
              onChange={(event) => onRationaleChange(event.target.value)}
              placeholder={labels.rationalePlaceholder}
              rows={3}
              disabled={isPending}
              className="mt-1.5 text-sm"
            />
            {rationaleMissing ? (
              <p className="mt-1 text-[11px] text-muted-foreground">{labels.rationaleRequired}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={isPending} onClick={() => onDecide("accept")}>
              {labels.accept}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={isPending || rationaleMissing}
              onClick={() => onDecide("reject")}
            >
              {labels.reject}
            </Button>
            {actions.includes("needs_more_evidence") ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending || rationaleMissing}
                onClick={() => onDecide("needs_more_evidence")}
              >
                {labels.needsMoreEvidence}
              </Button>
            ) : null}
            {actions.includes("undo") ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isPending || !hasDecision}
                onClick={() => onDecide("undo")}
              >
                {labels.undo}
              </Button>
            ) : null}
          </div>

          {actions.length > 0 && !actions.includes("needs_more_evidence") ? (
            <p className="text-[11px] text-muted-foreground">{labels.insightLimited}</p>
          ) : null}

          {isPending ? (
            <p className="text-xs text-muted-foreground" role="status">
              {labels.saving}
            </p>
          ) : null}

          {hasError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2" role="alert">
              <p className="text-xs font-medium text-destructive">{labels.errorTitle}</p>
              <Button type="button" size="sm" variant="outline" className="mt-2" disabled={isPending} onClick={onRetry}>
                {labels.retry}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/40 pt-3">
        <Button type="button" size="sm" variant="outline" disabled={!canPrevious} onClick={() => onNavigate(-1)}>
          {labels.previous}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={!canNext} onClick={() => onNavigate(1)}>
          {labels.next}
        </Button>
      </div>

      <p className="text-[10px] leading-relaxed text-muted-foreground">{labels.keyboardHint}</p>
    </aside>
  )
}

function badgeVariant(decision: ReviewWorkbenchItem["currentDecision"]) {
  switch (decision) {
    case "accepted":
      return "secondary" as const
    case "rejected":
      return "destructive" as const
    default:
      return "outline" as const
  }
}
