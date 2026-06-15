import { cn } from "@/lib/utils"

export function MaturityBadge({ maturity, className }: { maturity: string; className?: string }) {
  let baseClass = "bg-surface text-muted-foreground border-border/50"
  if (maturity === "STABLE") baseClass = "bg-success/10 text-success border-success/30"
  else if (maturity === "PARTIAL") baseClass = "bg-warning/10 text-warning border-warning/30"
  else if (maturity === "EXPERIMENTAL") baseClass = "bg-primary/10 text-primary border-primary/30"

  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border", baseClass, className)}>
      {maturity}
    </span>
  )
}

export function CertaintyBadge({ certainty, className }: { certainty: string; className?: string }) {
  let baseClass = "bg-surface text-muted-foreground border-border/50"
  if (certainty === "EVIDENCED") baseClass = "bg-success/10 text-success border-success/30"
  else if (certainty === "INFERRED") baseClass = "bg-info/10 text-info border-info/30"
  else if (certainty === "CONFLICTING") baseClass = "bg-danger/10 text-danger border-danger/30"
  else if (certainty === "UNKNOWN") baseClass = "bg-surface-muted text-muted-foreground border-border/60"

  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border", baseClass, className)}>
      {certainty}
    </span>
  )
}

export function ReviewStatusBadge({ status, className }: { status: string; className?: string }) {
  let baseClass = "bg-surface text-muted-foreground border-border/50"
  const label = status.replace("_", " ")

  if (status === "NEEDS_REVIEW") baseClass = "bg-warning/10 text-warning border-warning/30"
  else if (status === "CONFIRMED") baseClass = "bg-success/10 text-success border-success/30"
  else if (status === "REJECTED") baseClass = "bg-danger/10 text-danger border-danger/30"

  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border", baseClass, className)}>
      {label}
    </span>
  )
}

export function DiagnosticRiskBadge({ severity, className }: { severity: string; className?: string }) {
  let baseClass = "bg-surface text-muted-foreground border-border/50"
  
  if (severity === "BLOCKER") baseClass = "bg-danger/10 text-danger border-danger/40"
  else if (severity === "ERROR") baseClass = "bg-danger/10 text-danger border-danger/30"
  else if (severity === "WARN") baseClass = "bg-warning/10 text-warning border-warning/30"
  else if (severity === "INFO") baseClass = "bg-info/10 text-info border-info/30"

  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border", baseClass, className)}>
      {severity}
    </span>
  )
}

export function ArtifactKindBadge({ kind, className }: { kind: string; className?: string }) {
  // Most artifacts use a muted techy style
  const baseClass = "bg-surface-muted text-foreground/80 border-border/60 font-mono"

  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide border", baseClass, className)}>
      {kind}
    </span>
  )
}

export function AnalysisStatusBadge({ status, className }: { status: string; className?: string }) {
  let baseClass = "bg-surface-muted text-muted-foreground border-border/50"
  let label = status.replace(/_/g, " ")
  let showPulse = false

  if (status === "QUEUED") baseClass = "bg-surface text-muted-foreground border-border/50"
  else if (status === "RUNNING") {
    baseClass = "bg-primary/10 text-primary border-primary/40"
    showPulse = true
  }
  else if (status === "WAITING_FOR_REVIEW") {
    baseClass = "bg-warning/10 text-warning border-warning/40"
    label = "NEEDS REVIEW"
  }
  else if (status === "COMPLETED") baseClass = "bg-success/10 text-success border-success/40"
  else if (status === "FAILED") baseClass = "bg-danger/10 text-danger border-danger/40"
  else if (status === "CANCELLED") baseClass = "bg-surface-muted text-muted-foreground border-border/50"

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border", baseClass, className)}>
      {showPulse && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
      {label}
    </span>
  )
}

export function ScanStatusBadge({ status, className }: { status: string; className?: string }) {
  let baseClass = "bg-surface-muted text-muted-foreground border-border/50"
  const label = status
  let showPulse = false

  if (status === "QUEUED") baseClass = "bg-surface text-muted-foreground border-border/50"
  else if (status === "RUNNING") {
    baseClass = "bg-primary/10 text-primary border-primary/40"
    showPulse = true
  }
  else if (status === "COMPLETED") baseClass = "bg-success/10 text-success border-success/40"
  else if (status === "FAILED") baseClass = "bg-danger/10 text-danger border-danger/40"
  else if (status === "CANCELLED") baseClass = "bg-surface-muted text-muted-foreground border-border/50"

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border", baseClass, className)}>
      {showPulse && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
      {label}
    </span>
  )
}
