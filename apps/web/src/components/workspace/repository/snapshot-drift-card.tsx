import { useState } from "react"
import { useTranslations } from "next-intl"
import { useRepositorySnapshotDrift } from "@/hooks/api/use-snapshot-drift"
import { Activity, AlertTriangle, ChevronDown, ChevronUp, Layers, CheckCircle, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"

interface SnapshotDriftCardProps {
  projectId: string
  repositoryId: string
  baseSnapshotId?: string
  targetSnapshotId?: string
}

export function SnapshotDriftCard({ projectId, repositoryId, baseSnapshotId, targetSnapshotId }: SnapshotDriftCardProps) {
  const t = useTranslations("workspace")
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  const { data: drift, isLoading, error } = useRepositorySnapshotDrift(
    projectId,
    repositoryId,
    baseSnapshotId,
    targetSnapshotId
  )

  if (!baseSnapshotId) {
    return (
      <div className="flex flex-col gap-2 p-5 rounded-xl border border-border/40 bg-surface/50 backdrop-blur-xl shadow-sm">
        <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          {t("snapshotDrift")}
        </h3>
        <p className="text-[12px] text-muted-foreground">{t("noPreviousSnapshotDrift")}</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-5 rounded-xl border border-border/40 bg-surface/50 backdrop-blur-xl shadow-sm">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-[13px] font-semibold text-foreground">{t("snapshotDrift")}</h3>
        </div>
        <div className="h-20 bg-surface-soft/50 animate-pulse rounded-lg" />
      </div>
    )
  }

  if (error || !drift) {
    return (
      <div className="flex flex-col gap-2 p-5 rounded-xl border border-danger/20 bg-danger/5 shadow-sm">
        <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-danger" />
          {t("snapshotDrift")}
        </h3>
        <p className="text-[12px] text-muted-foreground">{t("failedLoadDriftSummary")}</p>
      </div>
    )
  }

  const { status, summary, versionComparison, coverageComparison, samples, warnings } = drift

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  return (
    <div className="flex flex-col gap-4 p-5 rounded-xl border border-border/40 bg-surface/50 backdrop-blur-xl shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-[13px] font-semibold text-foreground">{t("snapshotDrift")}</h3>
          {versionComparison.scannerVersionChanged || versionComparison.analyzerVersionChanged ? (
             <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded border border-border/50 ml-2">
               v{versionComparison.baseScannerVersion} → v{versionComparison.targetScannerVersion}
             </span>
          ) : null}
        </div>
        <div>
          <StatusBadge status={status} />
        </div>
      </div>
      
      <p className="text-[12px] text-muted-foreground mt-1 mb-2 px-1 border-b border-border/30 pb-2">
        {t("snapshotDriftDescription")}
      </p>

      {status === 'UNKNOWN' && (
        <p className="text-[12px] text-warning/90 mt-1 px-1">
          {t("snapshotDriftUnknownHash")}
        </p>
      )}

      {status === 'INCOMPATIBLE' && (
        <p className="text-[12px] text-danger/90 font-medium mt-1 px-1">
          {t("snapshotDriftIncompatible")}
        </p>
      )}

      {coverageComparison.coverageStatusChanged && (
        <p className="text-[12px] text-warning/90 mt-1 px-1">
          {t("coverageStatusChanged", {
            from: coverageComparison.baseCoverageStatus ?? t("unknown"),
            to: coverageComparison.targetCoverageStatus ?? t("unknown"),
          })}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1">
        <MetricCard label={t("added")} value={summary.addedArtifactCount} />
        <MetricCard label={t("removed")} value={summary.removedArtifactCount} />
        <MetricCard label={t("changed")} value={summary.changedArtifactCount} />
        <MetricCard label={t("unchanged")} value={summary.unchangedArtifactCount} />
      </div>

      {(summary.unknownChangedArtifactCount > 0 || summary.hashUnavailableArtifactCount > 0) && (
        <div className="grid grid-cols-2 gap-3 mt-1">
          <MetricCard label={t("unknownChanged")} value={summary.unknownChangedArtifactCount} isWarning />
          <MetricCard label={t("hashUnavailable")} value={summary.hashUnavailableArtifactCount} isWarning />
        </div>
      )}

      {warnings.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t("warnings")}</span>
          <div className="flex flex-wrap gap-2">
            {warnings.map((w, idx) => (
              <span key={idx} className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-surface-hover/50 px-2 py-1 text-[11px] text-foreground" title={w.message}>
                <span className="font-bold text-muted-foreground">{w.code}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 mt-2">
        {samples.addedArtifacts.length > 0 && (
          <SampleList 
            title={t("addedArtifacts")} 
            count={summary.addedArtifactCount}
            items={samples.addedArtifacts} 
            isExpanded={expandedSection === 'added'} 
            onToggle={() => toggleSection('added')} 
          />
        )}
        {samples.removedArtifacts.length > 0 && (
          <SampleList 
            title={t("removedArtifacts")} 
            count={summary.removedArtifactCount}
            items={samples.removedArtifacts} 
            isExpanded={expandedSection === 'removed'} 
            onToggle={() => toggleSection('removed')} 
          />
        )}
        {samples.changedArtifacts.length > 0 && (
          <SampleList 
            title={t("changedArtifacts")} 
            count={summary.changedArtifactCount}
            items={samples.changedArtifacts} 
            isExpanded={expandedSection === 'changed'} 
            onToggle={() => toggleSection('changed')} 
          />
        )}
        {samples.unknownChangedArtifacts.length > 0 && (
          <SampleList 
            title={t("unknownChangedArtifacts")} 
            count={summary.unknownChangedArtifactCount}
            items={samples.unknownChangedArtifacts} 
            isExpanded={expandedSection === 'unknown'} 
            onToggle={() => toggleSection('unknown')} 
          />
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("workspace")
  if (status === 'NO_DRIFT') {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-bold text-success uppercase px-2 py-1 bg-success/10 rounded-md border border-success/20">
        <CheckCircle className="w-3.5 h-3.5" /> {t("noDrift")}
      </span>
    )
  }
  if (status === 'DRIFTED') {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-bold text-info uppercase px-2 py-1 bg-info/10 rounded-md border border-info/20">
        <Layers className="w-3.5 h-3.5" /> {t("drifted")}
      </span>
    )
  }
  if (status === 'UNKNOWN') {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-bold text-warning uppercase px-2 py-1 bg-warning/10 rounded-md border border-warning/20">
        <AlertTriangle className="w-3.5 h-3.5" /> {t("unknown")}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-bold text-danger uppercase px-2 py-1 bg-danger/10 rounded-md border border-danger/20">
      <ShieldAlert className="w-3.5 h-3.5" /> {t("incompatible")}
    </span>
  )
}

function MetricCard({ label, value, isWarning }: { label: string; value: number; isWarning?: boolean }) {
  return (
    <div className={cn("flex flex-col p-3 rounded-lg border border-border/40 shadow-sm", isWarning ? "bg-warning/5" : "bg-surface-soft/40")}>
      <span className={cn("text-lg font-bold leading-none mb-2", isWarning ? "text-warning" : "text-foreground")}>{value}</span>
      <span className="text-[11px] font-medium text-muted-foreground leading-none">{label}</span>
    </div>
  )
}

interface SampleItem {
  artifactKey: string
  displayName?: string | null
  symbolName?: string | null
}

function SampleList({ title, count, items, isExpanded, onToggle }: { title: string, count: number, items: Array<SampleItem>, isExpanded: boolean, onToggle: () => void }) {
  const t = useTranslations("workspace")
  return (
    <div className="flex flex-col border border-border/40 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full p-3 text-left transition-colors hover:bg-surface-soft/60 bg-surface-soft/30"
      >
        <span className="text-[12px] font-medium text-foreground">{title} ({t("showingOf", { shown: items.length, total: count })})</span>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      
      {isExpanded && (
        <div className="flex flex-col p-3 bg-surface-soft/10 border-t border-border/40">
          <div className="flex flex-col gap-1 overflow-y-auto max-h-[240px] pr-2 custom-scrollbar">
            {items.map((item, idx) => (
              <div key={idx} className="flex flex-col gap-1 py-1 border-b border-border/20 last:border-0">
                <span className="text-[11px] font-mono text-muted-foreground truncate" title={item.artifactKey}>
                  {item.displayName || item.symbolName || item.artifactKey}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
