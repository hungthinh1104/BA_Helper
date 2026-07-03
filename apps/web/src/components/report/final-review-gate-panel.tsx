import { useState } from "react"
import { useReviewCompletion } from "@/hooks/api/use-review-completion"
import { Button } from "@/components/ui/button"
import { ShieldCheck, ShieldAlert, Loader2, FileCheck2, Download } from "lucide-react"
import { FinalReviewedReportViewer } from "./final-reviewed-report-viewer"
import { apiGetFile } from "@/lib/api-client"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

interface FinalReviewGatePanelProps {
  analysisId: string
}

export function FinalReviewGatePanel({ analysisId }: FinalReviewGatePanelProps) {
  const t = useTranslations("reports")
  const { data: completion, isLoading, error } = useReviewCompletion(analysisId)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownloadMarkdown = async () => {
    try {
      setIsDownloading(true)
      const file = await apiGetFile(`/api/v1/impact-analyses/${analysisId}/approved-report/export.md`)
      const url = URL.createObjectURL(file.blob)
      const a = document.createElement("a")
      a.href = url
      a.download = file.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(t("markdownDownloaded"), {
        description: `${t("file")}: ${file.filename}`,
      })
    } catch (err) {
      toast.error(t("downloadFailed"), {
        description: err instanceof Error ? err.message : t("couldNotFetchFinalReport"),
      })
    } finally {
      setIsDownloading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="mt-8 border-t border-border/50 pt-8 print:hidden flex items-center justify-center p-8 bg-surface-muted/50 rounded-lg border border-dashed border-border/40 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-3 opacity-70" />
        <span className="text-[13px] tracking-wide uppercase font-medium">{t("checkingFinalReviewGate")}</span>
      </div>
    )
  }

  if (error || !completion) {
    return (
      <div className="mt-8 border-t border-border/50 pt-8 print:hidden flex items-center p-6 bg-destructive/5 rounded-lg border border-destructive/20 text-destructive/80">
        <ShieldAlert className="w-5 h-5 mr-3 shrink-0" />
        <span className="text-[13px]">{t("failedReviewCompletionStatus")}</span>
      </div>
    )
  }

  const { isComplete, blockingReasons, unreviewed, totalLinks, accepted, rejected, needsReview, needsMoreEvidence, hasReviewedSnapshot } = completion

  const formatBlockingReason = (reason: string) => {
    switch (reason) {
      case 'UNREVIEWED_TRACEABILITY_LINKS':
        return t("blockedTraceabilityLinks")
      case 'REVIEWED_SNAPSHOT_MISSING':
        return t("blockedSnapshotMissing")
      case 'CONFLICTING_EVIDENCE_UNREVIEWED':
        return t("blockedConflictingEvidence")
      case 'CRITICAL_MISSING_EVIDENCE':
        return t("blockedCriticalMissingEvidence")
      case 'REVIEW_REQUIRED_ITEMS':
        return t("blockedReviewRequired")
      case 'HIGH_RISK_INSIGHT_UNREVIEWED':
        return t("blockedHighRiskInsight")
      default:
        return t("blockedGeneric", { reason })
    }
  }

  return (
    <div className="mt-8 border-t border-border/50 pt-8 print:hidden">
      <div className={`p-6 rounded-lg border ${isComplete ? 'bg-success-soft border-success/20' : 'bg-surface border-border/50'} relative overflow-hidden`}>
        
        {/* Subtle background decoration */}
        {isComplete && (
          <div className="absolute -right-12 -top-12 opacity-5 pointer-events-none">
            <ShieldCheck className="w-64 h-64 text-success" />
          </div>
        )}

        <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {isComplete ? (
                <ShieldCheck className="w-5 h-5 text-success" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-warning" />
              )}
              <h3 className="text-base font-semibold text-foreground tracking-tight">{t("finalReviewGate")}</h3>
            </div>
            
            <p className="text-[13px] text-muted-foreground leading-relaxed max-w-xl">
              {t("finalReviewGateDescription")}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
              <div className="bg-background rounded-md border border-border/50 p-3">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{t("total")}</div>
                <div className="font-mono text-base">{totalLinks}</div>
              </div>
              <div className="bg-background rounded-md border border-border/50 p-3">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{t("accepted")}</div>
                <div className="font-mono text-base text-success">{accepted}</div>
              </div>
              <div className="bg-background rounded-md border border-border/50 p-3">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{t("rejected")}</div>
                <div className="font-mono text-base text-destructive">{rejected}</div>
              </div>
              <div className="bg-background rounded-md border border-border/50 p-3">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{t("needsReviewShort")}</div>
                <div className="font-mono text-base text-info">{needsReview}</div>
              </div>
              <div className="bg-background rounded-md border border-border/50 p-3">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{t("moreEvidenceShort")}</div>
                <div className="font-mono text-base text-warning">{needsMoreEvidence}</div>
              </div>
              <div className={`bg-background rounded-md border p-3 ${unreviewed > 0 ? 'border-warning/30' : 'border-border/50'}`}>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{t("unreviewed")}</div>
                <div className={`font-mono text-base ${unreviewed > 0 ? 'text-warning' : 'text-muted-foreground'}`}>{unreviewed}</div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {!isComplete && blockingReasons.map(reason => (
                <div key={reason} className="flex items-center text-[12px] text-warning font-medium bg-warning-soft w-fit px-2 py-1 rounded-sm border border-warning/20">
                  <span className="mr-2">•</span> {formatBlockingReason(reason)}
                </div>
              ))}
              {!isComplete && !hasReviewedSnapshot && !blockingReasons.includes('REVIEWED_SNAPSHOT_MISSING') && (
                <div className="flex items-center text-[12px] text-warning font-medium bg-warning-soft w-fit px-2 py-1 rounded-sm border border-warning/20">
                  <span className="mr-2">•</span> {t("blockedSnapshotMissing")}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col items-end shrink-0 gap-3">
            {isComplete && (
              <span className="text-[12px] font-medium text-success tracking-wide uppercase">
                {t("readyForAuditedExport")}
              </span>
            )}
            
            <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
              <Button
                variant="outline"
                disabled={!isComplete || isDownloading}
                onClick={handleDownloadMarkdown}
                className="w-full md:w-auto font-medium"
              >
                {isDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                {t("downloadMd")}
              </Button>
              <Button
                disabled={!isComplete}
                onClick={() => setViewerOpen(true)}
                className="w-full md:w-auto font-medium"
              >
                <FileCheck2 className="w-4 h-4 mr-2" />
                {t("viewFinalReviewedReport")}
              </Button>
            </div>
            
            {!isComplete && (
              <span className="text-[11px] text-muted-foreground max-w-[200px] text-right">
                {t("completeReviewsUnlock")}
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
