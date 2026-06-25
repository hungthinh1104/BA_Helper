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

export function OverviewTab({
  workspace,
  locale,
  labels,
}: {
  workspace: AnalysisWorkspaceResponse
  locale: SupportedLocale
  labels: AnalysisWorkspaceLabels["overview"]
}) {
  const { overview, reportStatus, driftStatus } = workspace
  const counts = overview.counts

  return (
    <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
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
