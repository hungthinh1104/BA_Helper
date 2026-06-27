import { cn } from "@/lib/utils"
import { getDomainCapabilityBadge, type SupportedLocale } from "@/lib/i18n/status-labels"

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "muted"

interface StatusMeta {
  label: string
  tone: BadgeTone
  description?: string
  pulse?: boolean
}

function toneClass(tone: BadgeTone) {
  switch (tone) {
    case "success":
      return "border-success/30 bg-success/10 text-success"
    case "warning":
      return "border-warning/30 bg-warning/10 text-warning"
    case "danger":
      return "border-danger/30 bg-danger/10 text-danger"
    case "info":
      return "border-info/30 bg-info/10 text-info"
    case "muted":
      return "border-border/60 bg-surface-muted text-muted-foreground"
    default:
      return "border-border/50 bg-surface text-muted-foreground"
  }
}

function renderBadge(meta: StatusMeta, className?: string) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        toneClass(meta.tone),
        className,
      )}
      title={meta.description}
    >
      {meta.pulse ? <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" /> : null}
      {meta.label}
    </span>
  )
}

function defaultLabel(value: string) {
  return value.replace(/_/g, " ")
}

export function getMaturityMeta(maturity: string): StatusMeta {
  switch (maturity) {
    case "STABLE":
      return { label: "Stable", tone: "success", description: "Primary supported scanner path." }
    case "PARTIAL":
      return { label: "Partial", tone: "warning", description: "Usable with bounded scanner coverage." }
    case "EXPERIMENTAL":
      return { label: "Experimental", tone: "info", description: "Capability proof only; manual review required." }
    default:
      return { label: defaultLabel(maturity), tone: "neutral" }
  }
}

export function getCertaintyMeta(certainty: string): StatusMeta {
  switch (certainty) {
    case "EVIDENCED":
      return { label: "Evidenced", tone: "success", description: "Backed by persisted repository evidence." }
    case "INFERRED":
      return { label: "Inferred", tone: "info", description: "Derived from evidence, not directly proven." }
    case "UNKNOWN":
      return { label: "Unknown", tone: "muted", description: "Insufficient support; needs clarification or review." }
    case "CONFLICTING":
      return { label: "Conflicting", tone: "danger", description: "Evidence conflicts or suggests risk." }
    default:
      return { label: defaultLabel(certainty), tone: "neutral" }
  }
}

export function getReviewStatusMeta(status: string): StatusMeta {
  switch (status) {
    case "NEEDS_REVIEW":
      return { label: "Needs Review", tone: "warning", description: "A reviewer decision is still required." }
    case "CONFIRMED":
      return { label: "Confirmed", tone: "success", description: "Human review accepted this item." }
    case "REJECTED":
      return { label: "Rejected", tone: "danger", description: "Human review rejected this item." }
    default:
      return { label: defaultLabel(status), tone: "neutral" }
  }
}

export function getDiagnosticSeverityMeta(severity: string): StatusMeta {
  switch (severity) {
    case "BLOCKER":
      return { label: "Blocker", tone: "danger", description: "Blocks reliable extraction or review." }
    case "ERROR":
      return { label: "Error", tone: "danger", description: "High-risk scanner diagnostic." }
    case "WARN":
      return { label: "Warn", tone: "warning", description: "Bounded extraction warning." }
    case "INFO":
      return { label: "Info", tone: "info", description: "Context-only diagnostic; not a confirmed impact." }
    default:
      return { label: defaultLabel(severity), tone: "neutral" }
  }
}

export function getArtifactKindMeta(kind: string): StatusMeta {
  const kindUpper = kind.toUpperCase()

  if (kindUpper.includes("API") || kindUpper.includes("ENDPOINT")) {
    return { label: kind, tone: "info" }
  }
  if (kindUpper.includes("SERVICE") || kindUpper.includes("USECASE")) {
    return { label: kind, tone: "info" }
  }
  if (kindUpper.includes("MODEL") || kindUpper.includes("ENTITY") || kindUpper.includes("DATA")) {
    return { label: kind, tone: "success" }
  }
  if (kindUpper.includes("TEST") || kindUpper.includes("SPEC")) {
    return { label: kind, tone: "warning" }
  }
  if (kindUpper.includes("INSIGHT") || kindUpper.includes("NOTE")) {
    return { label: kind, tone: "muted" }
  }

  return { label: kind, tone: "neutral" }
}

export function getAnalysisStatusMeta(status: string): StatusMeta {
  switch (status) {
    case "QUEUED":
      return { label: "Queued", tone: "neutral" }
    case "RUNNING":
      return { label: "Running", tone: "info", pulse: true, description: "Analysis is processing persisted evidence." }
    case "WAITING_FOR_REVIEW":
      return { label: "Waiting for Review", tone: "warning", description: "Analysis output exists but review is incomplete." }
    case "COMPLETED":
      return { label: "Completed", tone: "success", description: "Analysis is finalized." }
    case "FAILED":
      return { label: "Failed", tone: "danger", description: "Analysis stopped and needs remediation or rerun." }
    case "CANCELLED":
      return { label: "Cancelled", tone: "muted" }
    case "STALE":
      return { label: "Stale", tone: "warning", description: "Repository target moved since this result was created." }
    default:
      return { label: defaultLabel(status), tone: "neutral" }
  }
}

export function getScanStatusMeta(status: string): StatusMeta {
  switch (status) {
    case "QUEUED":
      return { label: "Queued", tone: "neutral" }
    case "RUNNING":
      return { label: "Running", tone: "info", pulse: true, description: "Scanner is indexing repository evidence." }
    case "COMPLETED":
      return { label: "Completed", tone: "success" }
    case "FAILED":
      return { label: "Failed", tone: "danger", description: "Scan failed; evidence is unavailable or incomplete." }
    case "CANCELLED":
      return { label: "Cancelled", tone: "muted" }
    default:
      return { label: defaultLabel(status), tone: "neutral" }
  }
}

export function getCoverageStatusMeta(status: string): StatusMeta {
  switch (status) {
    case "READY":
    case "FULL":
      return { label: "Ready", tone: "success", description: "Snapshot is analysis-ready." }
    case "PARTIAL":
      return { label: "Partial", tone: "warning", description: "Snapshot is usable but coverage is bounded." }
    case "FAILED":
      return { label: "Failed", tone: "danger", description: "Scanner could not produce usable evidence." }
    default:
      return { label: defaultLabel(status), tone: "muted" }
  }
}

export function MaturityBadge({ maturity, className }: { maturity: string; className?: string }) {
  return renderBadge(getMaturityMeta(maturity), className)
}

export function CertaintyBadge({ certainty, className }: { certainty: string; className?: string }) {
  return renderBadge(getCertaintyMeta(certainty), className)
}

export function ReviewStatusBadge({ status, className }: { status: string; className?: string }) {
  return renderBadge(getReviewStatusMeta(status), className)
}

export function DiagnosticRiskBadge({ severity, className }: { severity: string; className?: string }) {
  return renderBadge(getDiagnosticSeverityMeta(severity), className)
}

export function ArtifactKindBadge({ kind, className }: { kind: string; className?: string }) {
  return renderBadge(getArtifactKindMeta(kind), cn("font-mono font-medium normal-case tracking-normal", className))
}

export function AnalysisStatusBadge({ status, className }: { status: string; className?: string }) {
  return renderBadge(getAnalysisStatusMeta(status), className)
}

export function ScanStatusBadge({ status, className }: { status: string; className?: string }) {
  return renderBadge(getScanStatusMeta(status), className)
}

export function CoverageStatusBadge({ status, className }: { status: string; className?: string }) {
  return renderBadge(getCoverageStatusMeta(status), className)
}

export function DomainStatusBadge({ 
  domainPackStatus, 
  locale,
  className 
}: { 
  domainPackStatus?: string | null
  locale?: SupportedLocale
  className?: string 
}) {
  const badgeData = getDomainCapabilityBadge({ domainPackStatus, locale })
  
  let tone: BadgeTone = "muted"
  if (badgeData.status === "STABLE") tone = "success"
  else if (badgeData.status === "PARTIAL") tone = "warning"
  else if (badgeData.status === "FALLBACK") tone = "muted"
  else if (badgeData.status === "EXPERIMENTAL") tone = "info"
  
  return renderBadge({
    label: badgeData.label,
    tone,
    description: badgeData.tooltip
  }, className)
}
