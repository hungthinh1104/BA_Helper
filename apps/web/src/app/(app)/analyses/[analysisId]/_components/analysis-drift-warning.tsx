"use client"

import { useAnalysisDriftFreshness } from "@/hooks/api/use-analyses"
import { AlertCircle, CheckCircle2, Info, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"

interface AnalysisDriftWarningProps {
  projectId: string | undefined
  analysisId: string
}

export function AnalysisDriftWarning({ projectId, analysisId }: AnalysisDriftWarningProps) {
  const { data: driftRecommendation, isLoading, error } = useAnalysisDriftFreshness(projectId, analysisId)

  if (!projectId || !analysisId || isLoading || error || !driftRecommendation) {
    return null
  }

  const { status, severity, reason } = driftRecommendation

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
      <div className="flex items-center gap-2 px-3 py-2 bg-warning/5 border border-warning/20 rounded-lg text-foreground/80">
        <AlertCircle className="w-4 h-4 shrink-0 text-warning" />
        <span className="text-[12px] font-medium leading-relaxed">
          {reason || "Repository freshness cannot be fully determined because some artifacts do not have content hashes."}
        </span>
      </div>
    )
  }

  if (status === 'INCOMPATIBLE') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-danger/10 border border-danger/20 rounded-lg text-foreground/90">
        <ShieldAlert className="w-4 h-4 shrink-0 text-danger" />
        <span className="text-[12px] font-medium leading-relaxed">
          {reason || "Repository scanner/analyzer versions changed significantly. Re-analysis is recommended."}
        </span>
      </div>
    )
  }

  // DRIFTED
  const isHighSeverity = severity === 'HIGH'
  
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-lg border",
      isHighSeverity 
        ? "bg-warning/10 border-warning/30 text-foreground/90" 
        : "bg-warning/5 border-warning/20 text-foreground/80"
    )}>
      <AlertCircle className={cn("w-4 h-4 shrink-0", isHighSeverity ? "text-warning" : "text-warning/80")} />
      <span className="text-[12px] font-medium leading-relaxed">
        {reason || "The repository has changed since this analysis was created. Review the drift summary before relying on this result."}
      </span>
    </div>
  )
}
