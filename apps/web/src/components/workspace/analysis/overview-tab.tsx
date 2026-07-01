"use client"

import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import {
  driftStatusLabels,
  exportStatusLabels,
  getLocalizedLabel,
  reportStatusLabels,
  type SupportedLocale,
} from "@/lib/i18n/status-labels"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { InlineReviewAction } from "../shared/inline-review-action"
import { AlertTriangle, Code, ShieldAlert } from "lucide-react"

export function OverviewTab({
  workspace,
  locale,
  labels,
}: {
  workspace: AnalysisWorkspaceResponse
  locale: SupportedLocale
  labels: AnalysisWorkspaceLabels["overview"]
}) {
  const { overview, reportStatus, driftStatus, risks, impactGroups } = workspace
  const counts = overview.counts

  const topRisks = risks.filter(r => r.reviewDecision === "needs_review").slice(0, 3)
  const topImpacts = impactGroups.flatMap(g => g.artifacts).filter(a => a.reviewDecision === "needs_review").slice(0, 3)

  return (
    <section className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-border/60 bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">{labels.currentState}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <InfoRow label={labels.requirementRevision} value={overview.requirement.revisionId} mono />
          <InfoRow label={labels.language} value={overview.requirement.language} />
          <InfoRow label={labels.domainProfile} value={overview.requirement.domainProfileId} />
          <InfoRow label={labels.snapshot} value={overview.snapshot.snapshotId} mono />
          <InfoRow label={labels.commit} value={overview.snapshot.commitSha} mono />
          <InfoRow label={labels.analyzer} value={overview.snapshot.analyzerVersion} />
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">{labels.backendCounts}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Metric label={labels.impactedArtifacts} value={counts.impactedArtifacts} />
          <Metric label={labels.evidenceItems} value={counts.evidenceItems} />
          <Metric label={labels.risks} value={counts.risks} />
          <Metric label={labels.unknowns} value={counts.unknowns} />
          <Metric label={labels.qaScenarios} value={counts.qaScenarios} />
          <Metric label={labels.pendingReview} value={counts.pendingReviewItems} />
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-surface p-4 xl:col-span-2">
        <h2 className="text-sm font-semibold text-foreground">{labels.reportAndDrift}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <InfoRow label={labels.reportStatus} value={getLocalizedLabel(reportStatusLabels, reportStatus.status, locale)} />
          <InfoRow label={labels.canExport} value={getLocalizedLabel(exportStatusLabels, reportStatus.canExport ? "yes" : "no", locale)} />
          <InfoRow label={labels.driftStatus} value={getLocalizedLabel(driftStatusLabels, driftStatus.status, locale)} />
          <InfoRow label={labels.freshnessBasis} value={driftStatus.basis} />
          <InfoRow label={labels.snapshotCommit} value={driftStatus.snapshotCommitSha} mono />
          <InfoRow label={labels.latestObservedCommit} value={driftStatus.latestObservedCommitSha ?? getLocalizedLabel(exportStatusLabels, "not_applicable", locale)} mono />
        </div>
      </div>
      </div>

      {/* Dense Dashboard Section */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Critical Insights */}
        <div className="rounded-lg border border-border/60 bg-surface flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60 bg-surface-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-warning" />
              <h2 className="text-sm font-semibold text-foreground">Top Critical Insights to Review</h2>
            </div>
            {topRisks.length > 0 && <span className="text-[10px] font-medium bg-warning/10 text-warning px-1.5 py-0.5 rounded">{counts.pendingReviewItems} pending</span>}
          </div>
          <div className="p-0 flex flex-col divide-y divide-border/60">
            {topRisks.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No critical insights pending review.</div>
            ) : (
              topRisks.map((risk) => (
                <div key={risk.insightId} className="flex items-start gap-3 p-4 hover:bg-surface-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-tight">{risk.title}</p>
                    <p className="text-[12px] text-muted-foreground mt-1 line-clamp-2">{risk.whyItMatters}</p>
                  </div>
                  <InlineReviewAction analysisId={overview.analysisId} itemId={risk.insightId ?? risk.riskId} itemType="insight" currentStatus={risk.reviewDecision.toUpperCase()} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Impacted Artifacts */}
        <div className="rounded-lg border border-border/60 bg-surface flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60 bg-surface-muted/30 flex items-center gap-2">
            <Code className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Top Impacted Artifacts</h2>
          </div>
          <div className="p-0 flex flex-col divide-y divide-border/60">
            {topImpacts.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No impacted artifacts pending review.</div>
            ) : (
              topImpacts.map((artifact) => (
                <div key={artifact.artifactId} className="flex items-start justify-between gap-3 p-4 hover:bg-surface-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{artifact.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate">{artifact.filePath}</p>
                  </div>
                  <InlineReviewAction analysisId={overview.analysisId} itemId={artifact.traceabilityLinkIds[0]} itemType="impact" currentStatus={artifact.reviewDecision.toUpperCase()} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/50 bg-background/40 p-3">
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-md border border-border/50 bg-background/40 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 truncate text-sm text-foreground ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  )
}
