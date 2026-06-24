"use client"

import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FinalizeAnalysisDialog } from "./finalize-analysis-dialog"
import { useReviewInsight, useReviewTraceabilityLink } from "@/hooks/api/use-analyses"
import { toast } from "sonner"

type ReviewItem = AnalysisWorkspaceResponse["reviewQueue"][number]

export function ReviewReportTab({
  workspace,
  finalizeStats,
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
      toast.success("Review decision saved.")
    } catch (error) {
      toast.error("Failed to save review decision", {
        description: error instanceof Error ? error.message : "Please try again.",
      })
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="rounded-lg border border-border/60 bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Review Queue</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Backend-ranked presentation items that still need human decision.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {workspace.reviewQueue.length} pending
          </span>
        </div>

        <div className="mt-4 grid gap-3">
          {workspace.reviewQueue.length === 0 ? (
            <p className="rounded-md border border-border/50 bg-background/40 p-4 text-sm text-muted-foreground">
              No pending review items.
            </p>
          ) : (
            workspace.reviewQueue.map((item) => (
              <article key={item.itemId} className="rounded-md border border-border/50 bg-background/40 p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {item.itemType} · {item.evidenceCount} evidence
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
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      disabled={isStale || item.itemType === "report"}
                      onClick={() => reviewItem(item, "CONFIRMED")}
                    >
                      Accept
                    </Button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <aside className="rounded-lg border border-border/60 bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Report Status</h2>
        <div className="mt-4 grid gap-3 text-sm">
          <StatusLine label="Report" value={workspace.reportStatus.status} />
          <StatusLine label="Drift" value={workspace.driftStatus.status} />
          <StatusLine label="Export" value={workspace.reportStatus.canExport ? "available" : "blocked"} />
          <StatusLine label="Document job" value={workspace.reportStatus.documentJobId ?? "none"} mono />
          <StatusLine label="Reviewed snapshot" value={workspace.reportStatus.reviewedReportSnapshotId ?? "none"} mono />
        </div>

        <FinalizeAnalysisDialog
          analysisId={workspace.overview.analysisId}
          commitSha={workspace.overview.snapshot.commitSha}
          stats={finalizeStats}
          isStale={isStale}
        >
          <Button className="mt-5 w-full" disabled={isStale}>
            Finalize Analysis
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
            Open Report
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
