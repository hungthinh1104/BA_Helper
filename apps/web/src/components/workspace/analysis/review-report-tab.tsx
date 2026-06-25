"use client"

import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FinalizeAnalysisDialog } from "./finalize-analysis-dialog"
import { useReviewInsight, useReviewTraceabilityLink } from "@/hooks/api/use-analyses"
import {
  driftStatusLabels,
  exportStatusLabels,
  getLocalizedLabel,
  reportStatusLabels,
  type SupportedLocale,
} from "@/lib/i18n/status-labels"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { toast } from "sonner"

type ReviewItem = AnalysisWorkspaceResponse["reviewQueue"][number]

export function ReviewReportTab({
  workspace,
  finalizeStats,
  locale,
  labels,
}: {
  workspace: AnalysisWorkspaceResponse
  finalizeStats: {
    total: number
    confirmed: number
    rejected: number
    unknowns: number
    conflicts: number
    needsReview: number
  }
  locale: SupportedLocale
  labels: AnalysisWorkspaceLabels["reviewReport"]
}) {
  const reviewInsight = useReviewInsight(undefined, workspace.overview.analysisId)
  const reviewLink = useReviewTraceabilityLink(undefined, workspace.overview.analysisId)
  const isStale = workspace.driftStatus.isStale

  const reviewItem = async (item: ReviewItem, status: "CONFIRMED" | "REJECTED") => {
    try {
      if (item.itemType === "impact") {
        await reviewLink.mutateAsync({
          traceabilityLinkId: item.itemId,
          data: { reviewStatus: status },
        })
      } else if (item.itemType !== "report") {
        await reviewInsight.mutateAsync({
          insightId: item.itemId,
          data: { reviewStatus: status },
        })
      }
      toast.success(labels.reviewSaved)
    } catch (error) {
      toast.error(labels.reviewSaveFailed, {
        description: error instanceof Error ? error.message : labels.retry,
      })
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="rounded-lg border border-border/60 bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{labels.reviewQueue}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {labels.reviewQueueDescription}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {workspace.reviewQueue.length} {labels.pending}
          </span>
        </div>

        <div className="mt-4 grid gap-3">
          {workspace.reviewQueue.length === 0 ? (
            <p className="rounded-md border border-border/50 bg-background/40 p-4 text-sm text-muted-foreground">
              {labels.noPendingItems}
            </p>
          ) : (
            workspace.reviewQueue.map((item) => (
              <article key={item.itemId} className="rounded-md border border-border/50 bg-background/40 p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {item.itemType} · {item.evidenceCount} {labels.evidence}
                    </div>
                    <h3 className="mt-1 text-sm font-medium text-foreground">{item.title}</h3>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                      {item.linkedArtifactKeys.join(", ") || item.itemId}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isStale || item.itemType === "report"}
                      onClick={() => reviewItem(item, "REJECTED")}
                    >
                      {labels.reject}
                    </Button>
                    <Button
                      size="sm"
                      disabled={isStale || item.itemType === "report"}
                      onClick={() => reviewItem(item, "CONFIRMED")}
                    >
                      {labels.accept}
                    </Button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <aside className="rounded-lg border border-border/60 bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">{labels.reportStatus}</h2>
        <div className="mt-4 grid gap-3 text-sm">
          <StatusLine label={labels.report} value={getLocalizedLabel(reportStatusLabels, workspace.reportStatus.status, locale)} />
          <StatusLine label={labels.drift} value={getLocalizedLabel(driftStatusLabels, workspace.driftStatus.status, locale)} />
          <StatusLine label={labels.export} value={getLocalizedLabel(exportStatusLabels, workspace.reportStatus.canExport ? "available" : "blocked", locale)} />
          <StatusLine label={labels.documentJob} value={workspace.reportStatus.documentJobId ?? getLocalizedLabel(exportStatusLabels, "none", locale)} mono />
          <StatusLine label={labels.reviewedSnapshot} value={workspace.reportStatus.reviewedReportSnapshotId ?? getLocalizedLabel(exportStatusLabels, "none", locale)} mono />
        </div>

        <FinalizeAnalysisDialog
          analysisId={workspace.overview.analysisId}
          commitSha={workspace.overview.snapshot.commitSha}
          stats={finalizeStats}
          isStale={isStale}
          labels={labels.finalizeDialog}
        >
          <Button className="mt-5 w-full" disabled={isStale}>
            {labels.finalizeAnalysis}
          </Button>
        </FinalizeAnalysisDialog>

        {workspace.reportStatus.canExport ? (
          <Button
            render={
              <Link
                href={`/reports?analysisId=${workspace.overview.analysisId}`}
                className="mt-2 w-full"
              />
            }
            variant="outline"
          >
            {labels.openReport}
          </Button>
        ) : null}
      </aside>
    </section>
  )
}

function StatusLine({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-md border border-border/50 bg-background/40 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 truncate text-foreground ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </div>
    </div>
  )
}
