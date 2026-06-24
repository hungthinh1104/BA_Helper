"use client"

import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"

export function OverviewTab({ workspace }: { workspace: AnalysisWorkspaceResponse }) {
  const { overview, reportStatus, driftStatus } = workspace
  const counts = overview.counts

  return (
    <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-lg border border-border/60 bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Current State</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <InfoRow label="Requirement revision" value={overview.requirement.revisionId} mono />
          <InfoRow label="Language" value={overview.requirement.language} />
          <InfoRow label="Domain profile" value={overview.requirement.domainProfileId} />
          <InfoRow label="Snapshot" value={overview.snapshot.snapshotId} mono />
          <InfoRow label="Commit" value={overview.snapshot.commitSha} mono />
          <InfoRow label="Analyzer" value={overview.snapshot.analyzerVersion} />
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Backend Counts</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Metric label="Impacted artifacts" value={counts.impactedArtifacts} />
          <Metric label="Evidence items" value={counts.evidenceItems} />
          <Metric label="Risks" value={counts.risks} />
          <Metric label="Unknowns" value={counts.unknowns} />
          <Metric label="QA scenarios" value={counts.qaScenarios} />
          <Metric label="Pending review" value={counts.pendingReviewItems} />
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-surface p-4 xl:col-span-2">
        <h2 className="text-sm font-semibold text-foreground">Report & Drift</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <InfoRow label="Report status" value={reportStatus.status} />
          <InfoRow label="Can export" value={reportStatus.canExport ? "yes" : "no"} />
          <InfoRow label="Drift status" value={driftStatus.status} />
          <InfoRow label="Freshness basis" value={driftStatus.basis} />
          <InfoRow label="Snapshot commit" value={driftStatus.snapshotCommitSha} mono />
          <InfoRow label="Latest observed commit" value={driftStatus.latestObservedCommitSha ?? "n/a"} mono />
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
