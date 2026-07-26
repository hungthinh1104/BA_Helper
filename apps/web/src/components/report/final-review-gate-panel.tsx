import { useState } from "react"
import { useReviewCompletion } from "@/hooks/api/use-review-completion"
import { Button } from "@/components/ui/button"
import { ShieldCheck, ShieldAlert, Loader2, FileCheck2, Download } from "lucide-react"
import { FinalReviewedReportViewer } from "./final-reviewed-report-viewer"
import { apiGetFile } from "@/lib/api-client"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { DenseAlert, DenseCard } from "@/components/workspace/shared/dense-card"

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
      <DenseCard variant="dashed" className="mt-8 items-center justify-center p-8 text-muted-foreground print:hidden">
        <Loader2 className="w-5 h-5 animate-spin mr-3 opacity-70" />
        <span className="text-[13px] tracking-wide uppercase font-medium">{t("checkingFinalReviewGate")}</span>
      </DenseCard>
    )
  }

  if (error || !completion) {
    return (
      <DenseAlert variant="danger" className="mt-8 items-center p-6 text-destructive/80 print:hidden">
        <ShieldAlert className="w-5 h-5 mr-3 shrink-0" />
        <span className="text-[13px]">{t("failedReviewCompletionStatus")}</span>
      </DenseAlert>
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
      <DenseCard className={`relative p-6 ${isComplete ? 'bg-success-soft border-success/20' : 'bg-surface border-border/50'}`}>
        
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
              <GateMetric label={t("total")} value={totalLinks} />
              <GateMetric label={t("accepted")} value={accepted} valueClassName="text-success" />
              <GateMetric label={t("rejected")} value={rejected} valueClassName="text-destructive" />
              <GateMetric label={t("needsReviewShort")} value={needsReview} valueClassName="text-info" />
              <GateMetric label={t("moreEvidenceShort")} value={needsMoreEvidence} valueClassName="text-warning" />
              <GateMetric
                label={t("unreviewed")}
                value={unreviewed}
                className={unreviewed > 0 ? "border-warning/30" : undefined}
                valueClassName={unreviewed > 0 ? "text-warning" : "text-muted-foreground"}
              />
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
      </DenseCard>

      <FinalReviewedReportViewer 
        analysisId={analysisId} 
        open={viewerOpen} 
        onOpenChange={setViewerOpen} 
      />
    </div>
  )
}

function GateMetric({
  label,
  value,
  className,
  valueClassName,
}: {
  label: string
  value: number
  className?: string
  valueClassName?: string
}) {
  return (
    <DenseCard className={`bg-background p-3 ${className ?? ""}`}>
      <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono text-base tabular-nums ${valueClassName ?? ""}`}>{value}</div>
    </DenseCard>
  )
}
