"use client"

import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FinalizeAnalysisDialog } from "@/components/workspace/analysis/finalize-analysis-dialog"
import { AnalysisHeader } from "@/components/workspace/analysis/analysis-header"
import { E2ETimeline } from "@/components/workspace/analysis/e2e-timeline"
import type { ImpactAnalysisResponse } from "@ba-helper/contracts"

type TabValue = "insights" | "graph" | "traceability-matrix" | "qa-coverage" | "review-queue" | "diff" | "lineage"

interface AnalysisStats {
  confirmed: number
  rejected: number
  unknowns: number
  conflicts: number
  total: number
  needsReview: number
}

interface AnalysisTabBarProps {
  analysis: ImpactAnalysisResponse
  canFinalize: boolean
  stats: AnalysisStats
  activeTab: TabValue
  onTabChange: (tab: TabValue) => void
  blockingRemaining: number
}

export function AnalysisTabBar({
  analysis,
  canFinalize,
  stats,
  activeTab,
  onTabChange,
  blockingRemaining,
}: AnalysisTabBarProps) {
  const router = useRouter()

  const tabClass = (tab: TabValue) =>
    `min-h-10 shrink-0 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 whitespace-nowrap
     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-t ${
      activeTab === tab
        ? "border-primary text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`

  return (
    <div className="flex flex-col">
      <div className="mb-4">
        <AnalysisHeader
          analysis={analysis}
          blockingRemaining={blockingRemaining}
          stats={stats}
        />
      </div>

      <div className="mb-4 rounded-lg border border-border/50 bg-surface px-4 py-2 shadow-sm">
        <details className="group">
          <summary className="mb-1.5 flex cursor-pointer items-center gap-2 select-none text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            <span className="group-open:rotate-90 transition-transform">▶</span>
            Analysis Timeline
          </summary>
          <div className="pb-1 pt-2">
            <E2ETimeline
              repoConnected={true}
              scanJobStatus={analysis.snapshot.coverageStatus ? "COMPLETED" : "RUNNING"}
              snapshotCoverage={analysis.snapshot.coverageStatus}
              snapshotIndex={analysis.snapshot.indexStatus}
              analysisStatus={analysis.status}
              hasApprovedReport={analysis.status === "COMPLETED"}
            />
          </div>
        </details>
      </div>

      <div className="analysis-sticky-header">
        {/* Tab bar */}
        <div role="tablist" className="flex items-center gap-0 overflow-x-auto border-b border-border/40 pb-1">
          <button role="tab" aria-selected={activeTab === "insights"} onClick={() => onTabChange("insights")} className={tabClass("insights")}>
            Evidence & Insights
          </button>
          <button role="tab" aria-selected={activeTab === "traceability-matrix"} onClick={() => onTabChange("traceability-matrix")} className={tabClass("traceability-matrix")}>
            Traceability
          </button>
          <button role="tab" aria-selected={activeTab === "qa-coverage"} onClick={() => onTabChange("qa-coverage")} className={tabClass("qa-coverage")}>
            QA & Unknowns
          </button>
          <button role="tab" aria-selected={activeTab === "review-queue"} onClick={() => onTabChange("review-queue")} className={tabClass("review-queue")}>
            Review Queue
            {blockingRemaining > 0 && (
              <span className="inline-flex items-center justify-center bg-danger text-white text-[10px] rounded-full w-4 h-4">
                {blockingRemaining}
              </span>
            )}
          </button>
          <button role="tab" aria-selected={activeTab === "graph"} onClick={() => onTabChange("graph")} className={tabClass("graph")}>
            Graph
          </button>
          {analysis.derivedFromAnalysisId && (
            <button role="tab" aria-selected={activeTab === "diff"} onClick={() => onTabChange("diff")} className={tabClass("diff")}>
              Impact Diff
            </button>
          )}
          {!analysis.derivedFromAnalysisId ? null : (
            <button role="tab" aria-selected={activeTab === "lineage"} onClick={() => onTabChange("lineage")} className={tabClass("lineage")}>
              Lineage
            </button>
          )}
        </div>

        {/* Global banners */}
        {analysis.status === "COMPLETED" && (
          <div className="mt-3 flex items-center justify-between gap-3 px-4 py-2.5 bg-primary/10 border border-primary/25 rounded-lg text-sm text-primary font-medium">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-xs">✓</span>
              </div>
              This analysis has been finalized. Open the report view to confirm approved-report availability and stale state.
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 bg-surface shadow-none"
              onClick={() => router.push(`/reports?analysisId=${analysis.id}`)}
            >
              View Report
            </Button>
          </div>
        )}

        {analysis.freshness.isStale && analysis.status === "WAITING_FOR_REVIEW" && (
          <div className="mt-3 flex items-center gap-3 px-4 py-2.5 bg-warning/10 border border-warning/25 rounded-lg text-sm text-warning font-medium">
            <AlertCircle className="w-5 h-5" />
            This analysis is stale because the repository snapshot has changed. You can still review insights, but finalization is disabled.
          </div>
        )}

        {!analysis.freshness.isStale && analysis.status === "WAITING_FOR_REVIEW" && (
          <div
            className={`mt-3 flex items-center justify-between gap-3 px-4 py-2.5 border rounded-lg text-sm font-medium ${
              blockingRemaining === 0
                ? "bg-success/10 border-success/25 text-success"
                : "bg-surface border-border text-muted-foreground"
            }`}
          >
            <div className="flex items-center gap-3">
              {blockingRemaining === 0 ? (
                <>
                  <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center shrink-0">
                    <span className="text-xs">✓</span>
                  </div>
                  All required items have been reviewed. You can now finalize this analysis.
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  Cannot finalize: {blockingRemaining} items still require review.
                </>
              )}
            </div>
            {canFinalize ? (
              <FinalizeAnalysisDialog
                analysisId={analysis.id}
                commitSha={analysis.snapshot.commitSha}
                stats={stats}
                isStale={analysis.freshness.isStale}
              >
                <Button
                  size="sm"
                  className={`h-8 border-none shadow-none ${
                    blockingRemaining === 0
                      ? "bg-success hover:bg-success/90 text-white"
                      : "bg-surface-muted text-muted-foreground"
                  }`}
                  disabled={blockingRemaining > 0}
                >
                  Finalize Analysis
                </Button>
              </FinalizeAnalysisDialog>
            ) : (
              <span className="text-[12px] text-muted-foreground">
                An Analyst or Owner can finalize this analysis.
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
