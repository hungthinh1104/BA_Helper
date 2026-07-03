"use client"

import type { ReactNode } from "react"
import type { AnalysisWorkspaceResponse, ImpactGraphResponse } from "@ba-helper/contracts"
import { AlertTriangle, GitBranch, Network, ShieldCheck, TestTube2 } from "lucide-react"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { cn } from "@/lib/utils"

type Labels = AnalysisWorkspaceLabels["metrics"]

export function AnalysisTrustMetricsPanel({
  workspace,
  graph,
  labels,
}: {
  workspace: AnalysisWorkspaceResponse
  graph?: ImpactGraphResponse
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

  const graphNodeCount = graph?.nodes.length ?? projectedGraphNodeCount(workspace)
  const graphEdgeCount = graph?.edges.length ?? projectedGraphEdgeCount(workspace)
  const graphIsLive = Boolean(graph)
  const qaRiskRatio = ratio(workspace.qaScenarios.length, Math.max(workspace.risks.length, 1))
  const highRiskCount = workspace.risks.filter((risk) => risk.severity === "high").length
  const linkedEvidenceCount = workspace.evidenceCards.filter((card) => card.artifactId).length
  const linkedEvidenceRatio = ratio(linkedEvidenceCount, evidenceItems)

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label={labels.sectionLabel}>
      <MetricCard
        label={labels.evidenceSupport}
        value={formatPercent(evidenceSupportRatio)}
        detail={labels.evidenceSupportDetail
          .replace("{supported}", String(artifactsWithEvidence))
          .replace("{total}", String(impactedArtifacts))}
        tone={evidenceSupportRatio >= 0.8 ? "success" : evidenceSupportRatio >= 0.5 ? "warning" : "danger"}
        icon={<ShieldCheck className="h-4 w-4" />}
      />
      <MetricCard
        label={labels.reviewProgress}
        value={formatPercent(reviewProgressRatio)}
        detail={finalizeBlockers > 0
          ? labels.reviewProgressBlocked.replace("{count}", String(finalizeBlockers))
          : labels.reviewProgressReady}
        tone={finalizeBlockers > 0 ? "warning" : "success"}
        icon={<AlertTriangle className="h-4 w-4" />}
      />
      <MetricCard
        label={graphIsLive ? labels.graphShape : labels.projectedGraphShape}
        value={`${graphNodeCount} / ${graphEdgeCount}`}
        detail={graphIsLive ? labels.graphShapeDetail : labels.projectedGraphShapeDetail}
        tone="info"
        icon={<Network className="h-4 w-4" />}
      />
      <MetricCard
        label={labels.qaRiskCoverage}
        value={formatPercent(qaRiskRatio)}
        detail={labels.qaRiskCoverageDetail
          .replace("{qa}", String(workspace.qaScenarios.length))
          .replace("{risks}", String(workspace.risks.length))
          .replace("{high}", String(highRiskCount))}
        tone={highRiskCount > 0 && workspace.qaScenarios.length === 0 ? "danger" : "neutral"}
        icon={<TestTube2 className="h-4 w-4" />}
      />
      <MetricCard
        label={labels.linkedEvidence}
        value={formatPercent(linkedEvidenceRatio)}
        detail={labels.linkedEvidenceDetail
          .replace("{linked}", String(linkedEvidenceCount))
          .replace("{total}", String(evidenceItems))}
        tone={linkedEvidenceRatio >= 0.8 ? "success" : "warning"}
        icon={<GitBranch className="h-4 w-4" />}
        className="md:col-span-2 xl:col-span-4"
      />
    </section>
  )
}

function MetricCard({
  label,
  value,
  detail,
  tone,
  icon,
  className,
}: {
  label: string
  value: string
  detail: string
  tone: "success" | "warning" | "danger" | "info" | "neutral"
  icon: ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-lg border border-border/40 bg-surface p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
        </div>
        <div className={cn(
          "rounded-md border p-2",
          tone === "success" && "border-success/20 bg-success/10 text-success",
          tone === "warning" && "border-warning/20 bg-warning/10 text-warning",
          tone === "danger" && "border-danger/20 bg-danger/10 text-danger",
          tone === "info" && "border-info/20 bg-info/10 text-info",
          tone === "neutral" && "border-border/50 bg-surface-muted text-muted-foreground",
        )}>
          {icon}
        </div>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{detail}</p>
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

function projectedGraphNodeCount(workspace: AnalysisWorkspaceResponse) {
  return 1 +
    workspace.overview.counts.impactedArtifacts +
    workspace.overview.counts.risks +
    workspace.overview.counts.unknowns +
    workspace.overview.counts.qaScenarios
}

function projectedGraphEdgeCount(workspace: AnalysisWorkspaceResponse) {
  const traceabilityEdges = workspace.impactGroups
    .flatMap((group) => group.artifacts)
    .reduce((sum, artifact) => sum + artifact.traceabilityLinkIds.length, 0)
  const evidenceEdges = workspace.evidenceCards.reduce(
    (sum, card) => sum + card.linkedInsightIds.length + card.linkedTraceabilityLinkIds.length,
    0,
  )
  return traceabilityEdges + evidenceEdges
}
