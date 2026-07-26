"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, Loader2 } from "lucide-react"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import { Button } from "@/components/ui/button"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { resolveAnalysisExperienceState } from "./analysis-experience-state"
import { FinalizeAnalysisDialog, formatReviewApprovalBlocker } from "./finalize-analysis-dialog"
import { writeAnalysisWorkbenchUrlState } from "./workbench/analysis-workbench-url-state"

/**
 * The single, state-aware primary call-to-action for an analysis. It derives the
 * next step from {@link resolveAnalysisExperienceState} and routes the reviewer
 * to it: continue the review, finalize (through the finalize dialog, which lands
 * on the approved report), view the report, or re-run a stale analysis. Blocker
 * reasons and the headline counts sit beside the CTA.
 */
export function AnalysisPrimaryCta({
  workspace,
  labels,
}: {
  workspace: AnalysisWorkspaceResponse
  labels: AnalysisWorkspaceLabels
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const state = resolveAnalysisExperienceState(workspace)
  const cta = labels.primaryCta

  const pushWorkbench = (patch: Parameters<typeof writeAnalysisWorkbenchUrlState>[1]) => {
    const params = writeAnalysisWorkbenchUrlState(new URLSearchParams(searchParams?.toString() ?? ""), patch)
    const query = params.toString()
    router.push(query ? `${pathname ?? ""}?${query}` : pathname ?? "", { scroll: false })
  }

  const summary = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground" data-cta-summary>
      {state.blockers > 0 ? <span className="font-medium text-destructive">{cta.blockers.replace("{count}", String(state.blockers))}</span> : null}
      {state.pending > 0 ? <span>{cta.pending.replace("{count}", String(state.pending))}</span> : null}
      {state.evidenceGaps > 0 ? <span>{cta.evidenceGaps.replace("{count}", String(state.evidenceGaps))}</span> : null}
    </div>
  )

  const blockerReasons =
    state.blockingReasons.length > 0 ? (
      <div className="max-w-xs text-right text-[11px] text-muted-foreground" data-cta-blockers>
        <span className="font-medium text-foreground">{cta.blockedTitle}</span>
        <span>: {state.blockingReasons.map(formatReviewApprovalBlocker).join(" · ")}</span>
      </div>
    ) : null

  if (state.primaryAction === "processing" || state.primaryAction === "report_generating") {
    return (
      <div className="flex flex-col items-start gap-1 lg:items-end" data-cta-status={state.primaryAction}>
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          {state.primaryAction === "processing" ? cta.processing : cta.reportGenerating}
        </span>
      </div>
    )
  }

  if (state.primaryAction === "failed") {
    return (
      <div className="flex flex-col items-start gap-1 lg:items-end" data-cta-failed>
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-destructive">
          <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
          {cta.failed}
        </span>
        <Button size="sm" variant="outline" onClick={() => pushWorkbench({ view: "history" })}>
          {cta.rerun}
        </Button>
      </div>
    )
  }

  if (state.primaryAction === "finalize") {
    return (
      <div className="flex flex-col items-start gap-1 lg:items-end">
        <FinalizeAnalysisDialog
          analysisId={workspace.overview.analysisId}
          commitSha={workspace.overview.snapshot.commitSha}
          stats={finalizeStats(workspace)}
          isStale={state.isStale}
          reportStatus={workspace.reportStatus}
          labels={labels.reviewReport.finalizeDialog}
        >
          <Button size="sm">{cta.finalize}</Button>
        </FinalizeAnalysisDialog>
        {summary}
      </div>
    )
  }

  const onClick =
    state.primaryAction === "view_report"
      ? () => router.push(`/reports?analysisId=${workspace.overview.analysisId}`)
      : state.primaryAction === "rerun"
        ? () => pushWorkbench({ view: "history" })
        : () => pushWorkbench({ view: "review", filter: state.recommendedFilter })

  const label =
    state.primaryAction === "view_report"
      ? cta.viewReport
      : state.primaryAction === "rerun"
        ? cta.rerun
        : cta.continueReview

  return (
    <div className="flex flex-col items-start gap-1 lg:items-end">
      <Button size="sm" variant={state.primaryAction === "rerun" ? "outline" : "default"} onClick={onClick}>
        {label}
      </Button>
      {summary}
      {blockerReasons}
    </div>
  )
}

function finalizeStats(workspace: AnalysisWorkspaceResponse) {
  const queue = workspace.reviewQueue
  return {
    total: queue.length,
    confirmed: queue.filter((item) => item.currentDecision === "accepted").length,
    rejected: queue.filter((item) => item.currentDecision === "rejected").length,
    unknowns: workspace.overview.counts.unknowns,
    conflicts: workspace.impactGroups
      .flatMap((group) => group.artifacts)
      .filter((artifact) => artifact.impactBasis === "conflicting").length,
    needsReview: queue.filter((item) => item.currentDecision === "needs_review").length,
  }
}
