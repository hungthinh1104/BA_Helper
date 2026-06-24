"use client"

import { useMemo, useState } from "react"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import { cn } from "@/lib/utils"
import { OverviewTab } from "./overview-tab"
import { ImpactMapTab } from "./impact-map-tab"
import { EvidenceTab } from "./evidence-tab"
import { RisksQaTab } from "./risks-qa-tab"
import { ReviewReportTab } from "./review-report-tab"

type WorkspaceTab = "overview" | "impact" | "evidence" | "risks-qa" | "review-report"

const tabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "impact", label: "Impact Map" },
  { id: "evidence", label: "Evidence" },
  { id: "risks-qa", label: "Risks & QA" },
  { id: "review-report", label: "Review & Report" },
]

export function AnalysisWorkspaceShell({
  workspace,
}: {
  workspace: AnalysisWorkspaceResponse
}) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview")
  const stats = useMemo(() => {
    const reviewed = workspace.reviewQueue.filter(
      (item) => item.currentDecision !== "needs_review",
    ).length
    return {
      total:
        workspace.overview.counts.risks +
        workspace.overview.counts.unknowns +
        workspace.overview.counts.qaScenarios,
      confirmed: reviewed,
      rejected: 0,
      unknowns: workspace.overview.counts.unknowns,
      conflicts: workspace.risks.filter((risk) => risk.severity === "high").length,
      needsReview: workspace.overview.counts.pendingReviewItems,
    }
  }, [workspace])

  return (
    <div className="app-page-scroll flex min-h-0 flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-3 border-b border-border/50 pb-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Analysis Workspace
            </p>
            <h1 className="mt-1 truncate text-xl font-semibold text-foreground">
              {workspace.overview.requirement.title}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {workspace.overview.requirement.summary}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <StatusPill label="Analysis" value={workspace.overview.status.analysisStatus} />
            <StatusPill label="Review" value={workspace.overview.status.reviewStatus} />
            <StatusPill label="Drift" value={workspace.overview.status.driftStatus} />
          </div>
        </div>

        <nav
          aria-label="Analysis workspace sections"
          className="flex gap-1 overflow-x-auto"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn(
                "h-9 shrink-0 rounded-md px-3 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-surface-muted text-foreground"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {activeTab === "overview" && <OverviewTab workspace={workspace} />}
      {activeTab === "impact" && <ImpactMapTab groups={workspace.impactGroups} />}
      {activeTab === "evidence" && <EvidenceTab evidenceCards={workspace.evidenceCards} />}
      {activeTab === "risks-qa" && (
        <RisksQaTab
          risks={workspace.risks}
          unknowns={workspace.unknowns}
          qaScenarios={workspace.qaScenarios}
        />
      )}
      {activeTab === "review-report" && (
        <ReviewReportTab
          workspace={workspace}
          finalizeStats={stats}
        />
      )}
    </div>
  )
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-surface px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate text-xs font-medium text-foreground">
        {value.replace(/_/g, " ")}
      </div>
    </div>
  )
}
