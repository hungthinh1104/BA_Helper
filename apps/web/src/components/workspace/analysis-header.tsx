"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ImpactAnalysisResponse } from "@ba-helper/contracts"
import { WorkspacePageHeader } from "./page-header"
import { CheckCircle2, Loader2, Download } from "lucide-react"
import { toast } from "sonner"
import { apiGetFile } from "@/lib/api-client"

interface AnalysisHeaderProps {
  analysis: ImpactAnalysisResponse
  stats: {
    confirmed: number
    rejected: number
    unknowns: number
    conflicts: number
    total: number
    needsReview: number
  }
}

export function AnalysisHeader({ analysis, stats }: AnalysisHeaderProps) {
  const isStale = analysis.freshness.isStale
  const finalized = analysis.status === "COMPLETED"
  const canExport = analysis.capabilities.canExport && finalized && !isStale
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

      toast.success("Report Exported Successfully", {
        description: file.filename,
      })
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast.error("Export Failed", {
        description: error.message || "An unexpected error occurred while exporting.",
      })
    } finally {
      setExportingFormat(null)
    }
  }

  return (
    <div>
      {isStale && (
        <div className="mb-6 bg-warning/10 border border-warning/30 text-warning px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-warning animate-pulse"></span>
          Warning: The target branch has new commits. This analysis may be stale. Finalization is blocked.
        </div>
      )}

      {finalized && (
        <div className="mb-6 bg-success/10 border border-success/25 text-success px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Analysis finalized. The approved impact report is now available for export.
        </div>
      )}

      <WorkspacePageHeader
        title={analysis.requirement.revisionTitle}
        description={`Commit: ${analysis.snapshot.commitSha.substring(0, 7)} · Target: ${analysis.sourceTarget.requestedRef}`}
        className="mb-2.5"
      >
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 shadow-none bg-surface" 
          disabled={!canExport || exportingFormat !== null}
          onClick={() => handleExport("md")}
          title={!finalized ? "Finalize analysis before export" : isStale ? "Report is stale; rerun/finalize again before export" : undefined}
        >
          {exportingFormat === "md" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Export Markdown
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 shadow-none bg-surface" 
          disabled={!canExport || exportingFormat !== null}
          onClick={() => handleExport("pdf")}
          title={!finalized ? "Finalize analysis before export" : isStale ? "Report is stale; rerun/finalize again before export" : undefined}
        >
          {exportingFormat === "pdf" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Export PDF
        </Button>
      </WorkspacePageHeader>

      <div className="flex items-center gap-4 text-[13px] font-medium mb-2.5">
        <Badge variant="outline" className={`bg-surface font-semibold rounded-md uppercase tracking-wider text-[10px] ${
          finalized ? "text-success border-success/30" : "text-muted-foreground"
        }`}>
          {finalized ? "COMPLETED" : analysis.status}
        </Badge>
        <div className="h-4 w-px bg-border"></div>
        <div className="flex items-center gap-3">
          <span className="text-success">{stats.confirmed} Confirmed</span>
          <span className="text-muted-foreground">·</span>
          <span className={stats.unknowns > 0 ? "text-warning" : "text-muted-foreground"}>{stats.unknowns} Unknowns</span>
          {stats.conflicts > 0 && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-destructive">{stats.conflicts} Conflicts</span>
            </>
          )}
          {stats.needsReview > 0 && !finalized && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{stats.needsReview} unreviewed</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
