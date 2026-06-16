"use client"

import { useState } from "react"
import { CheckCircle2, Download, GitBranch, Loader2, ShieldAlert } from "lucide-react"

import type { ImpactAnalysisResponse } from "@ba-helper/contracts"

import { Button } from "@/components/ui/button"
import { WorkspacePageHeader } from "@/components/workspace/shared/page-header"
import {
  AnalysisStatusBadge,
  CoverageStatusBadge,
} from "@/components/workspace/shared/status-badges"
import { apiGetFile } from "@/lib/api-client"
import { toast } from "sonner"

interface AnalysisHeaderProps {
  analysis: ImpactAnalysisResponse
  canExport: boolean
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

function SummaryMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="min-w-[112px] rounded-lg border border-border/60 bg-surface-muted/40 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

export function AnalysisHeader({ analysis, canExport, blockingRemaining, stats }: AnalysisHeaderProps) {
  const isStale = analysis.freshness.isStale
  const finalized = analysis.status === "COMPLETED"
  const [exportingFormat, setExportingFormat] = useState<"md" | "pdf" | null>(null)

  const handleExport = async (format: "md" | "pdf") => {
    setExportingFormat(format)
    try {
      const file = await apiGetFile(
        `/api/v1/impact-analyses/${analysis.id}/approved-report/export.${format}`,
      )
      const url = window.URL.createObjectURL(file.blob)
      const a = document.createElement("a")
      a.href = url
      a.download = file.filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success("Report exported", {
        description: file.filename,
      })
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err))
      toast.error("Export failed", {
        description: error.message || "An unexpected error occurred while exporting.",
      })
    } finally {
      setExportingFormat(null)
    }
  }

  const exportBlockedReason = !finalized
    ? "Finalize analysis before export."
    : isStale
      ? "Approved report is stale. Re-run and finalize again before export."
      : undefined

  return (
    <div className="space-y-4">
      {isStale ? (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">Snapshot is stale.</p>
            <p className="leading-6">
              The tracked repository target has moved since this analysis was created. Review is still visible, but finalization and export stay blocked until a fresh analysis completes.
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
              Read the approved report view for persisted report state, stale warnings, and merged export availability.
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
        <Button
          variant="outline"
          size="sm"
          className="h-9 bg-surface shadow-none"
          disabled={!canExport || exportingFormat !== null}
          onClick={() => handleExport("md")}
          title={exportBlockedReason}
        >
          {exportingFormat === "md" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Export Markdown
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 bg-surface shadow-none"
          disabled={!canExport || exportingFormat !== null}
          onClick={() => handleExport("pdf")}
          title={exportBlockedReason}
        >
          {exportingFormat === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Export PDF
        </Button>
      </WorkspacePageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <AnalysisStatusBadge status={analysis.status} />
        <CoverageStatusBadge status={analysis.snapshot.coverageStatus ?? "UNKNOWN"} />
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <SummaryMetric label="Evidence Coverage" value={analysis.snapshot.coverageStatus ?? "Unknown"} />
        <SummaryMetric label="Review Remaining" value={`${blockingRemaining}`} />
        <SummaryMetric label="Confirmed" value={`${stats.confirmed}`} />
        <SummaryMetric label="Unknown / Risk" value={`${stats.unknowns + stats.conflicts}`} />
        <SummaryMetric label="Rejected" value={`${stats.rejected}`} />
      </div>
    </div>
  )
}
