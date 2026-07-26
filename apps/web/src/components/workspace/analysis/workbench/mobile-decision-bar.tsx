"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  supportedDecisionActions,
  type ReviewDecisionAction,
} from "@/hooks/api/use-review-item-decision"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import type { ReviewWorkbenchItem } from "./analysis-workbench-types"

type DecisionLabels = AnalysisWorkspaceLabels["reviewWorkbench"]["decision"]
type RationaleAction = "reject" | "needs_more_evidence"

/**
 * The mobile single-pane decision surface: a sticky bar exposing the full
 * decision set for the item, where the rationale-gated actions (reject,
 * needs-more-evidence) open a bottom rationale sheet instead of silently
 * doing nothing.
 */
export function MobileDecisionBar({
  item,
  rationale,
  onRationaleChange,
  onDecide,
  isPending,
  isStale,
  labels,
}: {
  item: ReviewWorkbenchItem
  rationale: string
  onRationaleChange: (value: string) => void
  onDecide: (action: ReviewDecisionAction) => void
  isPending: boolean
  isStale: boolean
  labels: DecisionLabels
}) {
  const [sheetAction, setSheetAction] = useState<RationaleAction | null>(null)
  const actions = supportedDecisionActions(item.itemType)
  const hasDecision = item.currentDecision !== "needs_review"
  const locked = isPending || isStale
  const rationaleMissing = rationale.trim().length === 0

  const request = (action: ReviewDecisionAction) => {
    if ((action === "reject" || action === "needs_more_evidence") && rationaleMissing) {
      setSheetAction(action)
      return
    }
    onDecide(action)
  }

  const confirmSheet = () => {
    if (sheetAction && !rationaleMissing) {
      onDecide(sheetAction)
      setSheetAction(null)
    }
  }

  return (
    <>
      <div
        data-mobile-action-bar
        className="sticky bottom-2 z-10 mt-3 grid grid-cols-2 gap-2 rounded-lg border border-border/50 bg-surface/95 p-2 shadow-lg backdrop-blur lg:hidden"
      >
        <Button type="button" size="sm" variant="secondary" disabled={locked} onClick={() => request("accept")}>
          {labels.accept}
        </Button>
        <Button type="button" size="sm" variant="destructive" disabled={locked} onClick={() => request("reject")}>
          {labels.reject}
        </Button>
        {actions.includes("needs_more_evidence") ? (
          <Button type="button" size="sm" variant="outline" disabled={locked} onClick={() => request("needs_more_evidence")}>
            {labels.needsMoreEvidence}
          </Button>
        ) : null}
        {actions.includes("undo") ? (
          <Button type="button" size="sm" variant="ghost" disabled={locked || !hasDecision} onClick={() => request("undo")}>
            {labels.undo}
          </Button>
        ) : null}
      </div>

      <Sheet
        open={sheetAction !== null}
        onOpenChange={(open) => {
          if (!open) setSheetAction(null)
        }}
      >
        <SheetContent side="bottom" className="p-4" data-rationale-sheet>
          <SheetTitle>{labels.rationaleLabel}</SheetTitle>
          <Textarea
            value={rationale}
            onChange={(event) => onRationaleChange(event.target.value)}
            placeholder={labels.rationalePlaceholder}
            rows={3}
            className="mt-3 text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="mt-3 w-full"
            disabled={rationaleMissing || locked}
            onClick={confirmSheet}
          >
            {sheetAction === "needs_more_evidence" ? labels.needsMoreEvidence : labels.reject}
          </Button>
        </SheetContent>
      </Sheet>
    </>
  )
}
