"use client"

import { useAnalysisDriftFreshness } from "@/hooks/api/use-analyses"
import { AlertCircle, CheckCircle2, Info, ShieldAlert, FileDigit, FilePlus, FileMinus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface AnalysisDriftWarningProps {
  projectId: string | undefined
  analysisId: string
}

export function AnalysisDriftWarning({ projectId, analysisId }: AnalysisDriftWarningProps) {
  const { data: driftRecommendation, isLoading, error } = useAnalysisDriftFreshness(projectId, analysisId)

  if (!projectId || !analysisId || isLoading || error || !driftRecommendation) {
    return null
  }

  const { status, severity, reason, driftSummary, shouldRerunAnalysis } = driftRecommendation

  const RerunCTA = () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="ml-auto inline-block">
            <Button size="sm" variant="secondary" className="h-7 text-xs px-3 font-semibold" disabled>
              Re-run analysis
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Re-analysis action will be added in a later phase.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  const ReviewCTA = () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="ml-auto inline-block">
            <Button size="sm" variant="secondary" className="h-7 text-xs px-3 font-semibold" disabled>
              Review drift details
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Drift details view will be added in a later phase.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  if (status === 'CURRENT') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-soft/40 border border-border/30 rounded-lg text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 text-foreground/50" />
        <span className="text-[12px] font-medium leading-relaxed">
          {reason || "This analysis is based on the latest usable repository snapshot."}
        </span>
      </div>
    )
  }

  if (status === 'UNKNOWN') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-warning/5 border border-warning/20 rounded-lg text-foreground/80 shadow-sm">
        <AlertCircle className="w-5 h-5 shrink-0 text-warning" />
        <span className="text-[13px] font-medium leading-relaxed">
          {reason || "Repository freshness cannot be fully determined because some artifacts do not have content hashes."}
        </span>
        <ReviewCTA />
      </div>
    )
  }

  if (status === 'INCOMPATIBLE') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-danger/10 border border-danger/20 rounded-lg text-foreground/90 shadow-sm">
        <ShieldAlert className="w-5 h-5 shrink-0 text-danger" />
        <span className="text-[13px] font-medium leading-relaxed flex-1">
          {reason || "Repository scanner/analyzer versions changed significantly. Re-analysis is recommended."}
        </span>
        <RerunCTA />
      </div>
    )
  }

  // DRIFTED
  const isHighSeverity = severity === 'HIGH'
  
  return (
      <div className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg border shadow-sm",
        isHighSeverity 
          ? "bg-warning/10 border-warning/30 text-foreground/90" 
          : "bg-warning/5 border-warning/20 text-foreground/80"
      )}>
        <AlertCircle className={cn("w-5 h-5 shrink-0", isHighSeverity ? "text-warning" : "text-warning/80")} />
        
        <div className="flex flex-col gap-1 flex-1">
          <span className="text-[13px] font-medium leading-relaxed">
            {reason || "The repository has changed since this analysis was created. Review the drift summary before relying on this result."}
          </span>
          {driftSummary && (
            <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground/80">
              {driftSummary.changedArtifactCount > 0 && (
                <span className="flex items-center gap-1" title="Changed Artifacts">
                  <FileDigit className="w-3 h-3 text-warning/70" /> {driftSummary.changedArtifactCount} changed
                </span>
              )}
              {driftSummary.addedArtifactCount > 0 && (
                <span className="flex items-center gap-1" title="Added Artifacts">
                  <FilePlus className="w-3 h-3 text-success/70" /> {driftSummary.addedArtifactCount} added
                </span>
              )}
              {driftSummary.removedArtifactCount > 0 && (
                <span className="flex items-center gap-1" title="Removed Artifacts">
                  <FileMinus className="w-3 h-3 text-danger/70" /> {driftSummary.removedArtifactCount} removed
                </span>
              )}
            </div>
          )}
        </div>

        {shouldRerunAnalysis ? <RerunCTA /> : <ReviewCTA />}
      </div>
  )
}
