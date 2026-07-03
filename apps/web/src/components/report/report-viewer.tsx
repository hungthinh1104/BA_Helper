"use client"

import { useApprovedReport, useFinalReviewedReport } from "@/hooks/api/use-approved-report"
import { useAnalysisDetail } from "@/hooks/api/use-analyses"
import { ApprovedImpactReportResponse } from "@ba-helper/contracts"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, FileWarning, Copy, Download, CheckCircle2, Loader2, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { apiGetFile } from "@/lib/api-client"
import { toast } from "sonner"
import { AnalysisStatusBadge } from "@/components/workspace/shared/status-badges"
import { EvaluationContextCard } from "./evaluation-context-card"
import { EvidenceQualitySummary } from "./evidence-quality-summary"
import { EvidenceQualityTable } from "./evidence-quality-table"
import { ReviewCoverageSummary } from "./review-coverage-summary"
import { ReviewedSnapshotPanel } from "./reviewed-snapshot-panel"
import { FinalReviewGatePanel } from "./final-review-gate-panel"
import { ReportMarkdown } from "./report-markdown"
import { normalizeAppLocale, type AppLocale } from "@/i18n/app-locale"

interface ReportViewerProps {
  analysisId: string
  printMode?: boolean
  locale?: AppLocale | string
}

export function ReportViewer({ analysisId, printMode = false, locale = "en" }: ReportViewerProps) {
  const t = useTranslations("reports")
  const reportLocale = normalizeAppLocale(locale)
  const { data: analysis, isLoading: analysisLoading } = useAnalysisDetail(analysisId)
  const isEnglish = reportLocale === "en"
  
  // Conditionally fetch approved report only if it's english
  const { data: approvedReport, isLoading: approvedLoading, error: approvedError } = useApprovedReport(analysisId, isEnglish ? analysis?.status : undefined)
  
  // Use the new localized final reviewed report if locale is provided
  const { data: localizedReport, isLoading: localizedLoading, error: localizedError } = useFinalReviewedReport(analysisId, reportLocale)
  
  const reportLoading = isEnglish ? approvedLoading : localizedLoading
  const error = isEnglish ? approvedError : localizedError
  const hasReport = isEnglish ? !!approvedReport : !!localizedReport
  const markdown = isEnglish ? approvedReport?.markdown : localizedReport?.markdown
  const isStale = isEnglish ? !!approvedReport?.isStale : false // localized report implicitly not stale if served, but we lack full status
  const staleReason = isEnglish ? approvedReport?.staleReason : undefined
  
  const commitSha = isEnglish ? approvedReport?.provenance.commitSha : analysis?.snapshot.commitSha
  const generatedAt = isEnglish ? approvedReport?.provenance.generatedAt : localizedReport?.createdAt

  const [copied, setCopied] = useState(false)
  const [exportingFormat, setExportingFormat] = useState<"md" | "pdf" | null>(null)

  const handleCopy = async () => {
    if (!markdown) return
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      const message = error instanceof Error ? error.message : t("copyUnavailable")
      toast.error(t("copyFailed"), {
        description: message,
      })
    }
  }

  const handleDownload = async (format: "md" | "pdf") => {
    if (!hasReport || isStale || !isEnglish) return;
    setExportingFormat(format);
    try {
      const file = await apiGetFile(`/api/v1/impact-analyses/${analysisId}/approved-report/export.${format}`);
      const url = URL.createObjectURL(file.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t("reportExported"), {
        description: file.filename,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("failedExportReport");
      toast.error(t("exportFailed"), {
        description: message,
      });
    } finally {
      setExportingFormat(null);
    }
  };

  const handlePrint = () => {
    if (printMode) {
      window.print()
      return
    }

    const printWindow = window.open(
      reportLocale === "en"
        ? `/reports/${analysisId}/print`
        : `/reports/${analysisId}/print?locale=${reportLocale}`,
      "_blank",
    )
    if (!printWindow) {
      toast.error(t("printPreviewBlocked"), {
        description: t("allowPopups"),
      })
      return
    }
    printWindow.opener = null
  }

  if (analysisLoading || reportLoading) {
    return (
      <div className="flex flex-col p-6 md:p-8 space-y-6">
        <Skeleton className="h-10 w-3/4 mb-4" />
        <Skeleton className="h-6 w-1/2 mb-8" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (error || !hasReport) {
    const isFinalizedWithoutApprovedReport = analysis?.status === "COMPLETED"
    return (
      <div className="m-8 flex flex-col items-center justify-center rounded-xl border border-border/60 bg-surface px-8 py-12 text-muted-foreground">
        <AlertCircle className="w-8 h-8 text-destructive mb-3" />
        <p className="font-medium text-foreground">
          {isFinalizedWithoutApprovedReport ? t("approvedSnapshotMissing") : t("approvedReportUnavailable")}
        </p>
        <p className="max-w-md text-center text-[13px]">
          {isFinalizedWithoutApprovedReport
            ? t("finalizedMissingSnapshot")
            : t("finalizeToGenerate")}
        </p>
      </div>
    )
  }

  return (
    <div
      className={`report-print-page flex flex-col bg-background p-6 md:p-8 ${
        printMode
          ? "mx-auto min-h-[297mm] w-full max-w-[210mm] shadow-sm print:min-h-0 print:max-w-none print:shadow-none"
          : ""
      }`}
    >
      {/* Report Header Metadata */}
      <header className="report-document-header mb-10 border-b border-border/50 pb-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{analysis?.requirement.revisionTitle || t("fallbackTitle")}</h1>
          <div className="flex flex-wrap items-center gap-2 print:hidden shrink-0">
            {!printMode && (
              <Button size="sm" variant="outline" className="h-8 gap-1.5 shadow-none" onClick={handleCopy}>
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? t("copied") : t("copyMarkdown")}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 shadow-none"
              onClick={handlePrint}
            >
              <Printer className="w-3.5 h-3.5" />
              {printMode ? t("printSavePdf") : t("openPrintPreview")}
            </Button>
            {!printMode && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 shadow-none"
                  onClick={() => handleDownload("md")}
                  disabled={isStale || exportingFormat !== null || !isEnglish}
                  title={!isEnglish ? t("englishExportOnly") : isStale ? t("staleExportBlocked") : undefined}
                >
                  {exportingFormat === "md" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {t("exportMarkdown")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 shadow-none"
                  onClick={() => handleDownload("pdf")}
                  disabled={isStale || exportingFormat !== null || !isEnglish}
                  title={!isEnglish ? t("englishExportOnly") : isStale ? t("staleExportBlocked") : undefined}
                >
                  {exportingFormat === "pdf" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {t("exportPdf")}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <AnalysisStatusBadge status={isStale ? "STALE" : "COMPLETED"} />
        </div>
        
        {isStale && (
          <div className="report-stale-warning mb-6 flex items-start gap-3 rounded-lg border border-warning/25 bg-warning/10 p-4 text-warning">
            <FileWarning className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-[13px] uppercase tracking-wider">{t("staleReportWarning")}</span>
              <span className="text-[13px] text-warning/80">
                {staleReason || t("staleDefaultReason")}
              </span>
              <span className="text-[12px] text-warning/75">
                {t("staleReadOnly")}
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-[13px] text-muted-foreground mb-8">
          {analysis?.requirement.id && (
            <div><strong className="text-foreground/80 font-medium">{t("requirementId")}:</strong> <span className="font-mono ml-2">{analysis.requirement.id}</span></div>
          )}
          {analysis?.snapshot.repositoryId && (
            <div><strong className="text-foreground/80 font-medium">{t("targetRepository")}:</strong> <span className="ml-2">{analysis.snapshot.repositoryId}</span></div>
          )}
          <div><strong className="text-foreground/80 font-medium">{t("targetCommit")}:</strong> <span className="font-mono ml-2">{commitSha?.substring(0, 7) || t("unknown")}</span></div>
          <div><strong className="text-foreground/80 font-medium">{t("generatedAt")}:</strong> <span className="ml-2">{generatedAt ? new Date(generatedAt).toLocaleDateString(reportLocale) : t("unknown")}</span></div>
        </div>
        
        {analysis?.requirement.rawText && (
          <div className="p-4 bg-surface-muted/50 rounded-lg border border-border/50 text-[13px] leading-relaxed text-foreground/90 italic">
            &quot;{analysis.requirement.rawText}&quot;
          </div>
        )}
      </header>

      {/* Markdown Content */}
      <ReportMarkdown markdown={markdown || ""} />

      {/* Structured Evidence Quality and Evaluation Context (Hidden for non-en locales if missing) */}
      {!printMode && (
        <>
          <div className="mt-12 space-y-8 border-t border-border/50 pt-8 print:hidden">
            {Boolean(isEnglish ? approvedReport?.reviewCoverageSummary : localizedReport?.reviewCoverageSummary) && <ReviewCoverageSummary summary={isEnglish ? approvedReport!.reviewCoverageSummary! : localizedReport!.reviewCoverageSummary!} />}
            {Boolean(isEnglish ? approvedReport?.evidenceQualitySummary : localizedReport?.evidenceQualitySummarySnapshot) && <EvidenceQualitySummary summary={isEnglish ? approvedReport!.evidenceQualitySummary! : localizedReport!.evidenceQualitySummarySnapshot as NonNullable<ApprovedImpactReportResponse["evidenceQualitySummary"]>} />}
            {isEnglish && Boolean(approvedReport?.evidenceQualityItems?.length) && (
              <EvidenceQualityTable analysisId={analysisId} items={approvedReport!.evidenceQualityItems!} />
            )}
            {isEnglish && approvedReport?.evaluationContext && <EvaluationContextCard context={approvedReport.evaluationContext} />}
          </div>

          {isEnglish && (
            <>
              <ReviewedSnapshotPanel analysisId={analysisId} />
              <FinalReviewGatePanel analysisId={analysisId} />
            </>
          )}
        </>
      )}
    </div>
  )
}
