"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ImpactAnalysisResponse } from "@ba-helper/contracts"
import { WorkspacePageHeader } from "./page-header"
import { FinalizeDialog } from "./finalize-dialog"
import { CheckCircle2 } from "lucide-react"
import { useFinalizeAnalysis } from "@/hooks/api/use-analyses"
import { toast } from "sonner"

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
  const [finalized, setFinalized] = useState(false)
  const [canExport, setCanExport] = useState(analysis.capabilities.canExport)

  const { mutateAsync: finalizeAnalysis } = useFinalizeAnalysis("default-project", analysis.id)

  const handleFinalize = async () => {
    try {
      await finalizeAnalysis()
      toast.success("Analysis finalized successfully")
      setFinalized(true)
      setCanExport(true)
    } catch (err: unknown) {
      toast.error("Failed to finalize analysis", {
        description: err instanceof Error ? err.message : "Please try again.",
      })
      throw err
    }
  }

  const canFinalize = analysis.capabilities.canFinalize && !finalized

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
        className="mb-4"
      >
        <Button variant="outline" size="sm" className="h-8 shadow-none bg-surface" disabled={!canExport}>
          Export Report
        </Button>
        {canFinalize && (
          <FinalizeDialog
            summary={{
              total: stats.total,
              confirmed: stats.confirmed,
              rejected: stats.rejected,
              unreviewed: stats.needsReview,
            }}
            onFinalize={handleFinalize}
          >
            <Button size="sm" className="h-8 shadow-none">Finalize Analysis</Button>
          </FinalizeDialog>
        )}
        {finalized && (
          <Button size="sm" className="h-8 shadow-none" disabled>Finalized</Button>
        )}
      </WorkspacePageHeader>

      <div className="flex items-center gap-4 text-[13px] font-medium mb-4">
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
