import { useState } from "react"
import { useTranslations } from "next-intl"
import { Activity, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, FileCode, Layers, SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DenseCard } from "@/components/workspace/shared/dense-card"

export interface ScanHealthPayload {
  coverageStatus: 'FULL' | 'PARTIAL' | 'FAILED'
  scannerVersion: string
  analyzerVersion: string
  scannedFileCount: number
  skippedFileCount: number
  artifactCount: number
  skippedSummary: Record<string, number>
  skippedFilesSample: Array<{ path: string; reason: string }>
  limits: {
    maxFiles: number
    maxFileBytes: number
    maxTotalBytes?: number
  }
  limitHits: {
    fileLimitHit: boolean
    repoSizeLimitHit: boolean
  }
}

export function parseScanHealthPayload(payload: unknown): ScanHealthPayload | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  
  if (typeof p.coverageStatus !== 'string') return null
  if (typeof p.scannedFileCount !== 'number') return null
  if (typeof p.skippedFileCount !== 'number') return null
  
  return p as unknown as ScanHealthPayload
}

const SKIP_REASON_MESSAGE_KEYS: Record<string, string> = {
  IGNORED_DIRECTORY: "skipReasonIgnoredDirectory",
  UNSUPPORTED_EXTENSION: "skipReasonUnsupportedExtension",
  GENERATED_FILE: "skipReasonGeneratedFile",
  VENDOR_FILE: "skipReasonVendorFile",
  BUILD_OUTPUT: "skipReasonBuildOutput",
  FILE_TOO_LARGE: "skipReasonFileTooLarge",
  REPO_FILE_LIMIT_EXCEEDED: "skipReasonRepoFileLimitExceeded",
  REPO_SIZE_LIMIT_EXCEEDED: "skipReasonRepoSizeLimitExceeded",
  SYMLINK_OUTSIDE_ROOT: "skipReasonSymlinkOutsideRoot",
  BINARY_FILE: "skipReasonBinaryFile",
  READ_ERROR: "skipReasonReadError",
  UNSUPPORTED_FRAMEWORK: "skipReasonUnsupportedFramework",
  UNSUPPORTED_LANGUAGE: "skipReasonUnsupportedLanguage",
}

export function ScanHealthCard({ payload }: { payload?: unknown }) {
  const t = useTranslations("workspace")
  const [showAllPaths, setShowAllPaths] = useState(false)
  const [expandedPaths, setExpandedPaths] = useState(false)

  const data = parseScanHealthPayload(payload)
  const getSkipReasonLabel = (reason: string) => {
    const key = SKIP_REASON_MESSAGE_KEYS[reason]
    return key ? t(key) : reason
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-2 p-5 rounded-xl border border-border/40 bg-surface/50 backdrop-blur-xl shadow-sm">
        <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          {t("scanHealth")}
        </h3>
        <p className="text-[12px] text-muted-foreground">{t("unableDisplayScanHealth")}</p>
      </div>
    )
  }

  const sortedSummary = Object.entries(data.skippedSummary || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])

  const samplePaths = data.skippedFilesSample || []
  const pathsToShow = showAllPaths ? samplePaths : samplePaths.slice(0, 20)

  return (
    <div className="flex flex-col gap-4 p-5 rounded-xl border border-border/40 bg-surface/50 backdrop-blur-xl shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-[13px] font-semibold text-foreground">{t("scanHealthOverview")}</h3>
          <div className="flex items-center gap-2 ml-2">
            <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded border border-border/50">
              {data.scannerVersion}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded border border-border/50">
              {data.analyzerVersion}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data.coverageStatus === 'FULL' ? (
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-success uppercase px-2 py-1 bg-success/10 rounded-md border border-success/20">
              <CheckCircle className="w-3.5 h-3.5" /> FULL
            </span>
          ) : data.coverageStatus === 'PARTIAL' ? (
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-warning uppercase px-2 py-1 bg-warning/10 rounded-md border border-warning/20">
              <AlertTriangle className="w-3.5 h-3.5" /> PARTIAL
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-danger uppercase px-2 py-1 bg-danger/10 rounded-md border border-danger/20">
              <AlertTriangle className="w-3.5 h-3.5" /> FAILED
            </span>
          )}
        </div>
      </div>

      {data.coverageStatus === 'PARTIAL' && (
        <p className="text-[12px] text-warning/90 -mt-1 leading-relaxed">
          {t("partialScanHealthDescription")}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3 mt-1">
        <MetricCard label={t("scannedFiles")} value={data.scannedFileCount} icon={<FileCode className="w-4 h-4" />} />
        <MetricCard label={t("skippedFiles")} value={data.skippedFileCount} icon={<SearchX className="w-4 h-4" />} />
        <MetricCard label={t("artifactsExtracted")} value={data.artifactCount} icon={<Layers className="w-4 h-4" />} />
      </div>

      {sortedSummary.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t("skipReasons")}</span>
          <div className="flex flex-wrap gap-2">
            {sortedSummary.map(([reason, count]) => (
              <span key={reason} className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-surface-hover/50 px-2 py-1 text-[11px] text-foreground">
                <span className="font-medium text-muted-foreground">{getSkipReasonLabel(reason)}</span>
                <span className="font-bold">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {samplePaths.length > 0 && (
        <DenseCard className="mt-2">
          <button
            onClick={() => setExpandedPaths(!expandedPaths)}
            className="flex items-center justify-between w-full p-3 text-left transition-colors hover:bg-surface-soft/60 bg-surface-soft/30"
          >
            <span className="text-[12px] font-medium text-foreground">{t("viewSamplePaths", { count: samplePaths.length })}</span>
            {expandedPaths ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          
          {expandedPaths && (
            <div className="flex flex-col p-3 bg-surface-soft/10 border-t border-border/40">
              <div className="flex flex-col gap-1 overflow-y-auto max-h-[240px] pr-2 custom-scrollbar">
                {pathsToShow.map((item, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-border/20 last:border-0">
                    <span className="text-[11px] font-mono text-muted-foreground break-all">{item.path}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-border/40 bg-surface text-muted-foreground whitespace-nowrap w-fit">
                      {getSkipReasonLabel(item.reason)}
                    </span>
                  </div>
                ))}
              </div>
              
              {samplePaths.length > 20 && (
                <div className="pt-3 mt-2 border-t border-border/30 flex justify-center">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAllPaths(!showAllPaths)}
                  >
                    {showAllPaths ? t("showLess") : t("showAllSampledPaths", { count: samplePaths.length })}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DenseCard>
      )}
    </div>
  )
}

function MetricCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col p-3 rounded-lg border border-border/40 bg-surface-soft/40 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="text-muted-foreground">
          {icon}
        </div>
        <span className="text-lg font-bold text-foreground leading-none">{value}</span>
      </div>
      <span className="text-[11px] font-medium text-muted-foreground leading-none">{label}</span>
    </div>
  )
}
