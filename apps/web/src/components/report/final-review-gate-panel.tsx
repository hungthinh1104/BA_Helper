import { useState } from "react"
import { useReviewCompletion } from "@/hooks/api/use-review-completion"
import { Button } from "@/components/ui/button"
import { ShieldCheck, ShieldAlert, Loader2, FileCheck2 } from "lucide-react"
import { FinalReviewedReportViewer } from "./final-reviewed-report-viewer"

interface FinalReviewGatePanelProps {
  analysisId: string
}

export function FinalReviewGatePanel({ analysisId }: FinalReviewGatePanelProps) {
  const { data: completion, isLoading, error } = useReviewCompletion(analysisId)
  const [viewerOpen, setViewerOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="mt-8 border-t border-border/50 pt-8 print:hidden flex items-center justify-center p-8 bg-surface-muted/50 rounded-lg border border-dashed border-border/40 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-3 opacity-70" />
        <span className="text-[13px] tracking-wide uppercase font-medium">Checking Final Review Gate...</span>
      </div>
    )
  }

  if (error || !completion) {
    return (
      <div className="mt-8 border-t border-border/50 pt-8 print:hidden flex items-center p-6 bg-destructive/5 rounded-lg border border-destructive/20 text-destructive/80">
        <ShieldAlert className="w-5 h-5 mr-3 shrink-0" />
        <span className="text-[13px]">Failed to load review completion status.</span>
      </div>
    )
  }

  const { isComplete, blockingReasons, unreviewed, totalLinks, accepted, rejected, needsReview, needsMoreEvidence, hasReviewedSnapshot } = completion

  const formatBlockingReason = (reason: string) => {
    switch (reason) {
      case 'UNREVIEWED_TRACEABILITY_LINKS':
        return "Blocked: unreviewed traceability links remain"
      case 'REVIEWED_SNAPSHOT_MISSING':
        return "Blocked: reviewed snapshot is missing"
      default:
        return `Blocked: ${reason}`
    }
  }

  return (
    <div className="mt-8 border-t border-border/50 pt-8 print:hidden">
      <div className={`p-6 rounded-lg border ${isComplete ? 'bg-green-500/5 border-green-500/20' : 'bg-surface border-border/50'} relative overflow-hidden`}>
        
        {/* Subtle background decoration */}
        {isComplete && (
          <div className="absolute -right-12 -top-12 opacity-5 pointer-events-none">
            <ShieldCheck className="w-64 h-64 text-green-500" />
          </div>
        )}

        <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {isComplete ? (
                <ShieldCheck className="w-5 h-5 text-green-500" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-orange-500" />
              )}
              <h3 className="text-base font-semibold text-foreground tracking-tight">Final Review Gate</h3>
            </div>
            
            <p className="text-[13px] text-muted-foreground leading-relaxed max-w-xl">
              This gate verifies that all traceability links have been human-reviewed and an immutable snapshot has been taken.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
              <div className="bg-background rounded-md border border-border/50 p-3">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Total</div>
                <div className="font-mono text-base">{totalLinks}</div>
              </div>
              <div className="bg-background rounded-md border border-border/50 p-3">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Accepted</div>
                <div className="font-mono text-base text-green-500">{accepted}</div>
              </div>
              <div className="bg-background rounded-md border border-border/50 p-3">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Rejected</div>
                <div className="font-mono text-base text-destructive">{rejected}</div>
              </div>
              <div className="bg-background rounded-md border border-border/50 p-3">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Needs Rev.</div>
                <div className="font-mono text-base text-blue-500">{needsReview}</div>
              </div>
              <div className="bg-background rounded-md border border-border/50 p-3">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">More Evid.</div>
                <div className="font-mono text-base text-orange-500">{needsMoreEvidence}</div>
              </div>
              <div className={`bg-background rounded-md border p-3 ${unreviewed > 0 ? 'border-orange-500/30' : 'border-border/50'}`}>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Unreviewed</div>
                <div className={`font-mono text-base ${unreviewed > 0 ? 'text-orange-500' : 'text-muted-foreground'}`}>{unreviewed}</div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {!isComplete && blockingReasons.map(reason => (
                <div key={reason} className="flex items-center text-[12px] text-orange-500 font-medium bg-orange-500/10 w-fit px-2 py-1 rounded-sm border border-orange-500/20">
                  <span className="mr-2">•</span> {formatBlockingReason(reason)}
                </div>
              ))}
              {!isComplete && !hasReviewedSnapshot && !blockingReasons.includes('REVIEWED_SNAPSHOT_MISSING') && (
                <div className="flex items-center text-[12px] text-orange-500 font-medium bg-orange-500/10 w-fit px-2 py-1 rounded-sm border border-orange-500/20">
                  <span className="mr-2">•</span> Blocked: reviewed snapshot is missing
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col items-end shrink-0 gap-3">
            {isComplete && (
              <span className="text-[12px] font-medium text-green-500 tracking-wide uppercase">
                Ready for audited export
              </span>
            )}
            
            <Button
              disabled={!isComplete}
              onClick={() => setViewerOpen(true)}
              className="w-full md:w-auto font-medium"
            >
              <FileCheck2 className="w-4 h-4 mr-2" />
              View Final Reviewed Report
            </Button>
            
            {!isComplete && (
              <span className="text-[11px] text-muted-foreground max-w-[200px] text-right">
                Complete all reviews and take a snapshot to unlock final report
              </span>
            )}
          </div>
        </div>
      </div>

      <FinalReviewedReportViewer 
        analysisId={analysisId} 
        open={viewerOpen} 
        onOpenChange={setViewerOpen} 
      />
    </div>
  )
}
