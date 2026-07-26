"use client"

import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { cn } from "@/lib/utils"

type Labels = AnalysisWorkspaceLabels["metrics"]

/**
 * Compact trust strip. A single horizontal band of the analysis's trust signals
 * (evidence support, review progress, QA/risk coverage, linked evidence). Graph
 * shape now lives in the Dependency Path view, not here.
 */
export function AnalysisTrustMetricsPanel({
  workspace,
  labels,
}: {
  workspace: AnalysisWorkspaceResponse
  labels: Labels
}) {
  const impactedArtifacts = workspace.overview.counts.impactedArtifacts
  const evidenceItems = workspace.overview.counts.evidenceItems
  const artifactsWithEvidence = workspace.impactGroups
    .flatMap((group) => group.artifacts)
    .filter((artifact) => artifact.evidenceIds.length > 0).length
  const evidenceSupportRatio = ratio(artifactsWithEvidence, impactedArtifacts)

  const reviewItems = workspace.reviewQueue.length
  const reviewedItems = workspace.reviewQueue.filter((item) => item.currentDecision !== "needs_review").length
  const reviewProgressRatio = ratio(reviewedItems, reviewItems)
  const finalizeBlockers =
    workspace.reviewQueue.filter((item) => item.blockingFinalize && item.currentDecision === "needs_review").length +
    (workspace.reportStatus.finalizeBlockingReasons?.length ?? 0)

  const qaRiskRatio = ratio(workspace.qaScenarios.length, Math.max(workspace.risks.length, 1))
  const highRiskCount = workspace.risks.filter((risk) => risk.severity === "high").length
  const linkedEvidenceCount = workspace.evidenceCards.filter((card) => card.artifactId).length
  const linkedEvidenceRatio = ratio(linkedEvidenceCount, evidenceItems)

  return (
    <section
      className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border/40 bg-surface px-4 py-2.5"
      aria-label={labels.sectionLabel}
    >
      <TrustStat
        label={labels.evidenceSupport}
        value={formatPercent(evidenceSupportRatio)}
        tone={evidenceSupportRatio >= 0.8 ? "success" : evidenceSupportRatio >= 0.5 ? "warning" : "danger"}
      />
      <TrustStat
        label={labels.reviewProgress}
        value={formatPercent(reviewProgressRatio)}
        hint={finalizeBlockers > 0 ? labels.reviewProgressBlocked.replace("{count}", String(finalizeBlockers)) : undefined}
        tone={finalizeBlockers > 0 ? "warning" : "success"}
      />
      <TrustStat
        label={labels.qaRiskCoverage}
        value={formatPercent(qaRiskRatio)}
        tone={highRiskCount > 0 && workspace.qaScenarios.length === 0 ? "danger" : "neutral"}
      />
      <TrustStat
        label={labels.linkedEvidence}
        value={formatPercent(linkedEvidenceRatio)}
        tone={linkedEvidenceRatio >= 0.8 ? "success" : "warning"}
      />
    </section>
  )
}

function TrustStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone: "success" | "warning" | "danger" | "neutral"
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm font-semibold",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-danger",
          tone === "neutral" && "text-foreground",
        )}
      >
        {value}
      </span>
      {hint ? <span className="text-[11px] text-warning">{hint}</span> : null}
    </div>
  )
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) return 0
  return Math.max(0, Math.min(1, numerator / denominator))
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}
