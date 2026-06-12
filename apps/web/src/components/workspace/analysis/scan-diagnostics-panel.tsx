import { useState } from "react"
import { AlertTriangle, ChevronDown, ChevronRight, Info, ShieldAlert, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { DiagnosticItem } from "@ba-helper/contracts"

export function ScanDiagnosticsPanel({ diagnostics }: { diagnostics: DiagnosticItem[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  if (!diagnostics || diagnostics.length === 0) return null

  const toggle = (code: string) => {
    setExpanded(prev => ({ ...prev, [code]: !prev[code] }))
  }

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'BLOCKER': return <ShieldAlert className="w-4 h-4 text-danger" />
      case 'ERROR': return <XCircle className="w-4 h-4 text-danger" />
      case 'WARN': return <AlertTriangle className="w-4 h-4 text-warning" />
      case 'INFO': return <Info className="w-4 h-4 text-primary" />
      default: return <Info className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getColorClass = (severity: string) => {
    switch (severity) {
      case 'BLOCKER': return "bg-danger/10 border-danger/20 text-danger"
      case 'ERROR': return "bg-danger/5 border-danger/20 text-danger"
      case 'WARN': return "bg-warning/10 border-warning/20 text-warning"
      case 'INFO': return "bg-primary/5 border-primary/20 text-primary"
      default: return "bg-surface border-border text-foreground"
    }
  }

  // Sort by severity
  const severityOrder = { BLOCKER: 0, ERROR: 1, WARN: 2, INFO: 3 }
  const sorted = [...diagnostics].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
  const summary = diagnostics.reduce(
    (acc, diagnostic) => {
      const count = diagnostic.count ?? 1
      acc[diagnostic.severity] += count
      return acc
    },
    { BLOCKER: 0, ERROR: 0, WARN: 0, INFO: 0 },
  )

  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl border border-border bg-surface/50 backdrop-blur-xl shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] font-bold tracking-tight text-foreground flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-muted-foreground" />
          Scan Diagnostics
        </h3>
      </div>
      <p className="text-[13px] text-muted-foreground/90 -mt-1 mb-2">
        Information about skipped files, redacted secrets, and framework limitations.
      </p>

      <div className="flex flex-wrap gap-2">
        {summary.BLOCKER > 0 && <SummaryBadge label="Blockers" value={summary.BLOCKER} tone="danger" />}
        {summary.ERROR > 0 && <SummaryBadge label="Errors" value={summary.ERROR} tone="danger-muted" />}
        {summary.WARN > 0 && <SummaryBadge label="Warnings" value={summary.WARN} tone="warning" />}
        {summary.INFO > 0 && <SummaryBadge label="Info" value={summary.INFO} tone="info" />}
      </div>

      <div className="flex flex-col gap-2">
        {sorted.map((diag) => (
          <div key={diag.code} className="flex flex-col border border-border rounded-lg overflow-hidden bg-surface-soft/30">
            <button
              onClick={() => toggle(diag.code)}
              className={cn(
                "flex items-center justify-between w-full p-3 text-left transition-colors hover:bg-surface-soft/60",
                expanded[diag.code] && "bg-surface-soft/60 border-b border-border"
              )}
            >
              <div className="flex items-center gap-3">
                {getIcon(diag.severity)}
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-foreground">{diag.code}</span>
                  {diag.count && diag.count > 1 && (
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-surface-hover border border-border text-muted-foreground">
                      {diag.count} occurrences
                    </span>
                  )}
                  {diag.category && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-border text-muted-foreground uppercase tracking-wider">
                      {diag.category}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border", getColorClass(diag.severity))}>
                  {diag.severity}
                </span>
                {expanded[diag.code] ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>
            
            {expanded[diag.code] && (
              <div className="flex flex-col gap-3 p-4 bg-surface-soft/20">
                <p className="text-[13px] text-foreground/90">{diag.message}</p>
                
                {diag.samplePaths && diag.samplePaths.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-1">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Sample Paths</span>
                    <ul className="flex flex-col gap-1">
                      {diag.samplePaths.map((path, idx) => (
                        <li key={idx} className="text-[12px] font-mono text-muted-foreground bg-surface-hover/50 px-2 py-1 rounded w-fit border border-border">
                          {path}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function SummaryBadge({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "danger" | "danger-muted" | "warning" | "info"
}) {
  const toneClass = {
    danger: "bg-danger/10 text-danger border-danger/30",
    "danger-muted": "bg-danger/5 text-danger border-danger/20",
    warning: "bg-warning/10 text-warning border-warning/30",
    info: "bg-primary/10 text-primary border-primary/30",
  }[tone]

  return (
    <span className={cn("inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] font-medium", toneClass)}>
      <span>{label}</span>
      <span className="rounded bg-background/40 px-1.5 py-0.5 text-[10px] font-bold">{value}</span>
    </span>
  )
}
