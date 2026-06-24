"use client"

import { useMemo, useState } from "react"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import { cn } from "@/lib/utils"
import {
  DEFAULT_ANALYSIS_WORKSPACE_LOCALE,
  analysisStatusLabels,
  driftStatusLabels,
  getLocalizedLabel,
  reviewStatusLabels,
  type SupportedLocale,
} from "@/lib/i18n/status-labels"
import { getAnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { OverviewTab } from "./overview-tab"
import { ImpactMapTab } from "./impact-map-tab"
import { EvidenceTab } from "./evidence-tab"
import { RisksQaTab } from "./risks-qa-tab"
import { ReviewReportTab } from "./review-report-tab"
import { LineageDiffTab } from "./lineage-diff-tab"

type WorkspaceTab = "overview" | "impact" | "evidence" | "risks-qa" | "review-report" | "lineage-diff"

export function AnalysisWorkspaceShell({
  workspace,
  locale = DEFAULT_ANALYSIS_WORKSPACE_LOCALE,
}: {
  workspace: AnalysisWorkspaceResponse
  locale?: SupportedLocale
}) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview")
  const labels = getAnalysisWorkspaceLabels(locale)
  const tabs: Array<{ id: WorkspaceTab; label: string }> = [
    { id: "overview", label: labels.tabs.overview },
    { id: "impact", label: labels.tabs.impact },
    { id: "evidence", label: labels.tabs.evidence },
    { id: "risks-qa", label: labels.tabs.risksQa },
    { id: "review-report", label: labels.tabs.reviewReport },
    { id: "lineage-diff", label: labels.tabs.lineageDiff },
  ]
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
              {labels.title}
            </p>
            <h1 className="mt-1 truncate text-xl font-semibold text-foreground">
              {workspace.overview.requirement.title}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {workspace.overview.requirement.summary}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <StatusPill
              label={labels.status.analysis}
              value={getLocalizedLabel(analysisStatusLabels, workspace.overview.status.analysisStatus, locale)}
            />
            <StatusPill
              label={labels.status.review}
              value={getLocalizedLabel(reviewStatusLabels, workspace.overview.status.reviewStatus, locale)}
            />
            <StatusPill
              label={labels.status.drift}
              value={getLocalizedLabel(driftStatusLabels, workspace.overview.status.driftStatus, locale)}
            />
          </div>
        </div>

        <nav
          aria-label={labels.navLabel}
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

      {activeTab === "overview" && <OverviewTab workspace={workspace} locale={locale} labels={labels.overview} />}
      {activeTab === "impact" && <ImpactMapTab groups={workspace.impactGroups} locale={locale} labels={labels.impactMap} />}
      {activeTab === "evidence" && <EvidenceTab evidenceCards={workspace.evidenceCards} labels={labels.evidence} />}
      {activeTab === "risks-qa" && (
        <RisksQaTab
          risks={workspace.risks}
          unknowns={workspace.unknowns}
          qaScenarios={workspace.qaScenarios}
          locale={locale}
          labels={labels.risksQa}
        />
      )}
      {activeTab === "review-report" && (
        <ReviewReportTab
          workspace={workspace}
          finalizeStats={stats}
          locale={locale}
          labels={labels.reviewReport}
        />
      )}
      {activeTab === "lineage-diff" && (
        <LineageDiffTab
          workspace={workspace}
          locale={locale}
          labels={labels.lineageDiff}
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
        {value}
      </div>
    </div>
  )
}
