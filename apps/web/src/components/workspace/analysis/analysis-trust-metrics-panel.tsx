"use client"

import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { cn } from "@/lib/utils"

type Labels = AnalysisWorkspaceLabels["metrics"]

export interface TrustMetrics {
  /** Impacted artifacts with at least one linked evidence card. */
  evidenceSupport: number
  /** Resolved review ratio (accepted + rejected over all reviewable items). */
  reviewProgress: number
  /** Backend policy-driven count of items still blocking finalization. */
  blockers: number
  /** Risks that have at least one QA scenario referencing them. */
  qaRiskCoverage: number
  /** Evidence cards anchored to a code artifact. */
  linkedEvidence: number
  /** A high-severity risk with no linked QA scenario. */
  highRiskUncovered: boolean
}

/**
 * Projects the trust metrics from backend-authored signals: the review ratio
 * and blocker count come straight from the backend reviewSummary (no client
 * re-derivation, no double counting), and QA/risk coverage is measured from the
 * actual QA -> risk linkage rather than a bare scenario/risk count.
 */
export function resolveTrustMetrics(workspace: AnalysisWorkspaceResponse): TrustMetrics {
  const { impactGroups, evidenceCards, risks, qaScenarios, reviewSummary, overview } = workspace

  const artifactsWithEvidence = impactGroups
    .flatMap((group) => group.artifacts)
    .filter((artifact) => artifact.evidenceIds.length > 0).length

  const riskIsCovered = (riskId: string) =>
    qaScenarios.some((scenario) => scenario.relatedRiskIds.includes(riskId))
  const coveredRisks = risks.filter((risk) => riskIsCovered(risk.riskId)).length

  return {
    evidenceSupport: ratio(artifactsWithEvidence, overview.counts.impactedArtifacts),
    reviewProgress: ratio(reviewSummary.reviewed, reviewSummary.total),
    blockers: reviewSummary.blocking,
    qaRiskCoverage: risks.length === 0 ? 1 : ratio(coveredRisks, risks.length),
    linkedEvidence: ratio(
      evidenceCards.filter((card) => card.artifactId).length,
      overview.counts.evidenceItems,
    ),
    highRiskUncovered: risks.some(
      (risk) => risk.severity === "high" && !riskIsCovered(risk.riskId),
    ),
  }
}

/**
 * Compact trust strip. A single horizontal band of the analysis's trust signals
 * (evidence support, review progress, QA/risk coverage, linked evidence),
 * projected from the backend read model.
 */
export function AnalysisTrustMetricsPanel({
  workspace,
  labels,
}: {
  workspace: AnalysisWorkspaceResponse
  labels: Labels
}) {
  const metrics = resolveTrustMetrics(workspace)

  return (
    <section
      className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border/40 bg-surface px-4 py-2.5"
      aria-label={labels.sectionLabel}
    >
      <TrustStat
        label={labels.evidenceSupport}
        value={formatPercent(metrics.evidenceSupport)}
        tone={metrics.evidenceSupport >= 0.8 ? "success" : metrics.evidenceSupport >= 0.5 ? "warning" : "danger"}
      />
      <TrustStat
        label={labels.reviewProgress}
        value={formatPercent(metrics.reviewProgress)}
        hint={metrics.blockers > 0 ? labels.reviewProgressBlocked.replace("{count}", String(metrics.blockers)) : undefined}
        tone={metrics.blockers > 0 ? "warning" : "success"}
      />
      <TrustStat
        label={labels.qaRiskCoverage}
        value={formatPercent(metrics.qaRiskCoverage)}
        tone={metrics.highRiskUncovered ? "danger" : "neutral"}
      />
      <TrustStat
        label={labels.linkedEvidence}
        value={formatPercent(metrics.linkedEvidence)}
        tone={metrics.linkedEvidence >= 0.8 ? "success" : "warning"}
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
