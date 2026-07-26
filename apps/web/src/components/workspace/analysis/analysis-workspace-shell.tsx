"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import { AlertTriangle } from "lucide-react"
import {
  DEFAULT_ANALYSIS_WORKSPACE_LOCALE,
  analysisStatusLabels,
  driftStatusLabels,
  getLocalizedLabel,
  reviewStatusLabels,
  type SupportedLocale,
} from "@/lib/i18n/status-labels"
import { getAnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { DomainStatusBadge } from "./../shared/status-badges"
import { AnalysisPrimaryCta } from "./analysis-primary-cta"
import { AnalysisTrustMetricsPanel } from "./analysis-trust-metrics-panel"
import { OverviewTab } from "./overview-tab"
import { RisksQaTab } from "./risks-qa-tab"
import { LineageDiffTab } from "./lineage-diff-tab"
import { AnalysisWorkspaceNavigation } from "./workbench/analysis-workspace-navigation"
import { readAnalysisWorkbenchUrlState } from "./workbench/analysis-workbench-url-state"
import { createAnalysisWorkbenchViewModel } from "./workbench/analysis-workbench-view-model"
import { AnalysisReviewWorkbench } from "./workbench/analysis-review-workbench"

export function AnalysisWorkspaceShell({
  workspace,
  locale = DEFAULT_ANALYSIS_WORKSPACE_LOCALE,
}: {
  workspace: AnalysisWorkspaceResponse
  locale?: SupportedLocale
}) {
  const searchParams = useSearchParams()
  const labels = getAnalysisWorkspaceLabels(locale)
  const urlState = readAnalysisWorkbenchUrlState(searchParams ?? new URLSearchParams())
  const workbench = useMemo(
    () => createAnalysisWorkbenchViewModel(workspace, urlState.item),
    [workspace, urlState.item],
  )
  const activeMode = urlState.view ?? workbench.defaultMode
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
          <div className="mt-3 flex flex-col gap-3 lg:items-end">
            <AnalysisPrimaryCta workspace={workspace} labels={labels} />
            <div className="flex flex-wrap items-center gap-4 lg:justify-end">
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

        <AnalysisWorkspaceNavigation defaultMode={workbench.defaultMode} labels={labels.tabs} />
      </header>

      <AnalysisTrustMetricsPanel
        workspace={workspace}
        labels={labels.metrics}
      />

      {activeMode === "summary" && <OverviewTab workspace={workspace} locale={locale} labels={labels.overview} />}
      {activeMode === "review" && (
        <AnalysisReviewWorkbench
          workspace={workspace}
          viewModel={workbench}
          locale={locale}
          labels={labels.reviewWorkbench}
          queueLabels={labels.reviewQueue}
          graphLabels={labels.graph}
        />
      )}
      {activeMode === "risks-qa" && (
        <RisksQaTab
          risks={workspace.risks}
          unknowns={workspace.unknowns}
          qaScenarios={workspace.qaScenarios}
          labels={labels.risksQa}
          analysisId={workspace.overview.analysisId}
          isStale={workspace.driftStatus.isStale}
        />
      )}
      {activeMode === "history" && (
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
