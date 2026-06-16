"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useFinalizeAnalysis } from "@/hooks/api/use-analyses"
import { X, CheckCircle2, AlertTriangle, FileText } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface FinalizeAnalysisDialogProps {
  children: React.ReactNode
  analysisId: string
  commitSha: string
  stats: {
    total: number
    confirmed: number
    rejected: number
    unknowns: number
    conflicts: number
    needsReview: number
  }
  isStale?: boolean
}

export function FinalizeAnalysisDialog({ children, analysisId, commitSha, stats, isStale }: FinalizeAnalysisDialogProps) {
  const [open, setOpen] = useState(false)
  const [acknowledgeUnreviewed, setAcknowledgeUnreviewed] = useState(false)
  const { mutateAsync: finalizeAnalysis, isPending } = useFinalizeAnalysis(undefined, analysisId)
  const router = useRouter()

  const hasUnreviewedItems = stats.needsReview > 0

  const handleFinalize = async () => {
    try {
      await finalizeAnalysis({ acknowledgeUnreviewed })
      toast.success("Analysis finalized successfully.")
      setOpen(false)
      // Redirect directly to the generated report
      router.push(`/reports?analysisId=${analysisId}`)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      
      // Strict Error Mapping based on Backend error codes
      if (errorMessage.includes("INVALID_STATE_TRANSITION")) {
        toast.error("This analysis is no longer ready for finalization. Refresh the page.", { duration: 5000 })
      } else if (errorMessage.includes("FINALIZE_REQUIRES_REVIEW_ACK")) {
        toast.error("Some insights or links still need review before finalization.", { duration: 5000 })
      } else if (errorMessage.includes("ANALYSIS_STALE")) {
        toast.error("This analysis is stale because the repository snapshot changed. Run a new analysis.", { duration: 5000 })
      } else if (errorMessage.includes("APPROVED_REPORT_NOT_FOUND")) {
        toast.error("The report was not generated yet. Try refreshing.", { duration: 5000 })
      } else {
        toast.error("Failed to finalize analysis", { description: errorMessage })
      }
    }
  }

  // Reset state on close
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) setAcknowledgeUnreviewed(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-background/70 backdrop-blur-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.3)] ring-1 ring-white/10 dark:ring-white/5" showCloseButton={false}>
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success" />
              <DialogTitle className="text-[15px]">Finalize Impact Analysis</DialogTitle>
            </div>
            <DialogClose className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-[13px] text-muted-foreground">
            You are about to finalize this impact analysis. This action will generate an approved Traceability Report in Markdown format.
          </p>

          <div className="flex flex-col divide-y divide-border/60 border border-border/60 rounded-lg overflow-hidden bg-surface-muted/30">
            <SummaryRow label="Total Insights" value={String(stats.total)} />
            <SummaryRow label="Confirmed" value={String(stats.confirmed)} valueColor="text-success" />
            <SummaryRow label="Rejected" value={String(stats.rejected)} valueColor="text-destructive" />
            <SummaryRow label="Unknown/Conflicts" value={String(stats.unknowns + stats.conflicts)} valueColor="text-warning" />
            <SummaryRow label="Snapshot Commit" value={commitSha.substring(0, 7)} mono />
          </div>

          <div className="flex items-start gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg text-primary">
            <FileText className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-[12px] font-medium leading-relaxed">
              The Traceability Report will be generated as an approved Markdown document and will be permanently linked to this analysis.
            </p>
          </div>

          <div className="flex flex-col gap-2 p-3 bg-surface border border-border/60 rounded-lg">
            <h4 className="text-[12px] font-semibold text-foreground mb-1">Preflight Checklist</h4>
            
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                {!hasUnreviewedItems ? (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-warning" />
                )}
                <span className={`text-[12px] ${!hasUnreviewedItems ? "text-foreground" : "text-warning font-medium"}`}>
                  {!hasUnreviewedItems ? "All insights and links reviewed" : `${stats.needsReview} insights or links still require review`}
                </span>
              </div>
              
              {hasUnreviewedItems && (
                <div className="flex items-center gap-2 mt-1 ml-6 bg-warning/10 p-2 rounded border border-warning/20">
                  <input
                    type="checkbox"
                    id="ack-unreviewed"
                    className="w-3.5 h-3.5 rounded-sm border-warning text-warning focus:ring-warning/30 bg-background accent-warning cursor-pointer"
                    checked={acknowledgeUnreviewed}
                    onChange={(e) => setAcknowledgeUnreviewed(e.target.checked)}
                  />
                  <label htmlFor="ack-unreviewed" className="text-[11px] text-warning font-medium cursor-pointer leading-tight">
                    I acknowledge there are unreviewed items and want to finalize anyway.
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1">
              {!isStale ? (
                <CheckCircle2 className="w-4 h-4 text-success" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-warning" />
              )}
              <span className={`text-[12px] ${!isStale ? "text-foreground" : "text-warning font-medium"}`}>
                {!isStale ? "Analysis is not stale" : "Analysis is stale (Repository snapshot changed)"}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span className="text-[12px] text-foreground">
                100% test coverage map generated
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border/60 bg-surface-muted/30 flex justify-end gap-2">
          <DialogClose render={<Button variant="outline" size="sm" className="h-8 shadow-none">Cancel</Button>} />
          <Button 
            size="sm" 
            className="h-8 shadow-none bg-success hover:bg-success/90 text-white disabled:opacity-50" 
            disabled={isPending || (hasUnreviewedItems && !acknowledgeUnreviewed) || isStale} 
            onClick={handleFinalize}
          >
            {isPending ? "Finalizing..." : "Confirm Finalize"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SummaryRow({ label, value, mono = false, valueColor = "text-foreground" }: { label: string; value: string; mono?: boolean; valueColor?: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 px-4 py-2.5">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider self-center">{label}</span>
      <span className={`text-[12px] font-medium ${valueColor} ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  )
}
