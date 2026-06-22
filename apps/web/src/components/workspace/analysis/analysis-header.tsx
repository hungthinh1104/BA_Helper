"use client"

import { useRouter } from "next/navigation"
import { CheckCircle2, FileText, GitBranch, ShieldAlert } from "lucide-react"

import type { ImpactAnalysisResponse } from "@ba-helper/contracts"

import { Button } from "@/components/ui/button"
import { WorkspacePageHeader } from "@/components/workspace/shared/page-header"
import {
  AnalysisStatusBadge,
  CoverageStatusBadge,
} from "@/components/workspace/shared/status-badges"
import { MetricCard } from "@/components/workspace/shared/primitives"

interface AnalysisHeaderProps {
  analysis: ImpactAnalysisResponse
  blockingRemaining: number
  stats: {
    confirmed: number
    rejected: number
    unknowns: number
    conflicts: number
    total: number
    needsReview: number
  }
}


export function AnalysisHeader({ analysis, blockingRemaining, stats }: AnalysisHeaderProps) {
  const router = useRouter()
  const isStale = analysis.freshness.isStale
  const finalized = analysis.status === "COMPLETED"

  return (
    <div className="space-y-4">
      {isStale ? (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">Snapshot is stale.</p>
            <p className="leading-6">
              The tracked repository target has moved since this analysis was created. Review is still visible, but finalization stays blocked until a fresh analysis completes.
            </p>
          </div>
        </div>
      ) : null}

      {finalized ? (
        <div className="flex items-start gap-3 rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">Analysis finalized.</p>
            <p className="leading-6">
              Read the approved report view for persisted report state, stale warnings, and export controls.
            </p>
          </div>
        </div>
      ) : null}

      <WorkspacePageHeader
        title={analysis.requirement.revisionTitle || analysis.requirement.id || "Current requirement change"}
        description={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5" />
              Target {analysis.sourceTarget.requestedRef}
            </span>
            <span>Commit {analysis.snapshot.commitSha.substring(0, 7)}</span>
          </div>
        }
        className="mb-0"
      >
        {finalized ? (
          <Button
            variant="outline"
            size="sm"
            className="h-9 bg-surface shadow-none"
            onClick={() => router.push(`/reports?analysisId=${analysis.id}`)}
          >
            <FileText className="mr-2 h-4 w-4" />
            View Report
          </Button>
        ) : null}
      </WorkspacePageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <AnalysisStatusBadge status={analysis.status} />
        {!finalized ? <CoverageStatusBadge status={analysis.snapshot.coverageStatus ?? "UNKNOWN"} /> : null}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
        <MetricCard label="Coverage" value={analysis.snapshot.coverageStatus ?? "Unknown"} />
        <MetricCard label="Review Remaining" value={`${blockingRemaining}`} />
        <MetricCard label="Risk / Unknown" value={`${stats.unknowns + stats.conflicts}`} />
      </div>
    </div>
  )
}
