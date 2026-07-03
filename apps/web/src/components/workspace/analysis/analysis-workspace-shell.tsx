"use client"

import { useMemo, useState } from "react"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import { AlertTriangle } from "lucide-react"
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
import { useImpactGraph } from "@/hooks/api/use-analyses"
import { DomainStatusBadge } from "./../shared/status-badges"
import { AnalysisTrustMetricsPanel } from "./analysis-trust-metrics-panel"
import { OverviewTab } from "./overview-tab"
import { ImpactMapTab } from "./impact-map-tab"
import { GraphTab } from "./graph-tab"
import { EvidenceTab } from "./evidence-tab"
import { RisksQaTab } from "./risks-qa-tab"
import { ReviewReportTab } from "./review-report-tab"
import { LineageDiffTab } from "./lineage-diff-tab"

type WorkspaceTab = "overview" | "impact" | "graph" | "evidence" | "risks-qa" | "review-report" | "lineage-diff"

export function AnalysisWorkspaceShell({
  workspace,
  locale = DEFAULT_ANALYSIS_WORKSPACE_LOCALE,
}: {
  workspace: AnalysisWorkspaceResponse
  locale?: SupportedLocale
}) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview")
  const labels = getAnalysisWorkspaceLabels(locale)
  const shouldFetchGraph = activeTab === "graph"
  const { data: graphData, isLoading: graphLoading } = useImpactGraph(workspace.overview.analysisId, {
    enabled: shouldFetchGraph,
  })
  const tabs: Array<{ id: WorkspaceTab; label: string }> = [
    { id: "overview", label: labels.tabs.overview },
    { id: "impact", label: labels.tabs.impact },
    { id: "graph", label: labels.tabs.graph },
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
    <div className="app-page-scroll flex min-h-0 flex-col gap-4 p-4 md:p-6 lg:p-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {labels.title}
              </p>
              <DomainStatusBadge 
                domainPackStatus={workspace.overview.requirement.domainPack?.status ?? null}
                locale={locale} 
              />
            </div>
            <h1 className="mt-1 truncate text-xl font-semibold text-foreground">
              {workspace.overview.requirement.title}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground line-clamp-2" title={workspace.overview.requirement.summary}>
              {workspace.overview.requirement.summary}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-3">
            <StatusPill
              label={labels.status.commit}
              value={workspace.overview.snapshot.commitSha.substring(0, 7)}
              mono
            />
            <div className="w-[1px] h-3 bg-border/60" />
            <StatusPill
              label={labels.status.analyzer}
              value={workspace.overview.snapshot.analyzerVersion}
            />
            <div className="w-[1px] h-3 bg-border/60" />
            <StatusPill
              label={labels.status.analysis}
              value={getLocalizedLabel(analysisStatusLabels, workspace.overview.status.analysisStatus, locale)}
            />
            <div className="w-[1px] h-3 bg-border/60" />
            <StatusPill
              label={labels.status.review}
              value={getLocalizedLabel(reviewStatusLabels, workspace.overview.status.reviewStatus, locale)}
            />
            <div className="w-[1px] h-3 bg-border/60" />
            <StatusPill
              label={labels.status.drift}
              value={getLocalizedLabel(driftStatusLabels, workspace.overview.status.driftStatus, locale)}
            />
          </div>
        </div>

        {workspace.overview.requirement.domainPack?.status === "PARTIAL" && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/8 p-3 text-[12px] text-foreground/80">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="leading-relaxed">
              <p>{labels.domainPack.partialWarning1}</p>
              <p>{labels.domainPack.partialWarning2}</p>
              <p>{labels.domainPack.partialWarning3}</p>
            </div>
          </div>
        )}

        <nav
          aria-label={labels.navLabel}
          className="flex gap-6 overflow-x-auto border-b border-border/40 pb-[1px]"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn(
                "h-9 shrink-0 text-[13px] font-medium transition-colors border-b-2 whitespace-nowrap",
                activeTab === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30",
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <AnalysisTrustMetricsPanel
        workspace={workspace}
        graph={graphData}
        labels={labels.metrics}
      />

      {activeTab === "overview" && <OverviewTab workspace={workspace} locale={locale} labels={labels.overview} />}
      {activeTab === "impact" && <ImpactMapTab groups={workspace.impactGroups} evidenceCards={workspace.evidenceCards} locale={locale} labels={labels.impactMap} analysisId={workspace.overview.analysisId} isStale={workspace.driftStatus.isStale} />}
      {activeTab === "graph" && (
        <GraphTab
          graph={graphData}
          isLoading={graphLoading}
          labels={labels.graph}
        />
      )}
      {activeTab === "evidence" && <EvidenceTab evidenceCards={workspace.evidenceCards} labels={labels.evidence} />}
      {activeTab === "risks-qa" && (
        <RisksQaTab
          risks={workspace.risks}
          unknowns={workspace.unknowns}
          qaScenarios={workspace.qaScenarios}
          labels={labels.risksQa}
          analysisId={workspace.overview.analysisId}
          isStale={workspace.driftStatus.isStale}
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

function StatusPill({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span className={`text-[12px] font-medium text-foreground ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  )
}
