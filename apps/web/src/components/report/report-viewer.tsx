"use client"

import { useApprovedReport } from "@/hooks/api/use-approved-report"
import { useAnalysisDetail } from "@/hooks/api/use-analyses"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, FileWarning, Copy, Download, CheckCircle2, Loader2, Printer } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { MermaidRenderer } from "@/components/workspace/shared/mermaid-renderer"
import remarkGfm from "remark-gfm"
import { apiGetFile } from "@/lib/api-client"
import { toast } from "sonner"
import { AnalysisStatusBadge } from "@/components/workspace/shared/status-badges"

interface ReportViewerProps {
  analysisId: string;
}

export function ReportViewer({ analysisId }: ReportViewerProps) {
  const { data: analysis, isLoading: analysisLoading } = useAnalysisDetail(analysisId)
  const { data: report, isLoading: reportLoading, error } = useApprovedReport(analysisId, analysis?.status)
  const [copied, setCopied] = useState(false)
  const [exportingFormat, setExportingFormat] = useState<"md" | "pdf" | null>(null)
  const printRootId = `report-print-root-${analysisId}`

  const handleCopy = async () => {
    if (!report?.markdown) return;
    try {
      await navigator.clipboard.writeText(report.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleDownload = async (format: "md" | "pdf") => {
    if (!report || report.isStale) return;
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
      toast.success("Report Exported Successfully", {
        description: file.filename,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to export report.";
      toast.error("Export Failed", {
        description: message,
      });
    } finally {
      setExportingFormat(null);
    }
  };

  const handlePrint = () => {
    const printRoot = document.getElementById(printRootId)
    if (!printRoot) {
      toast.error("Print unavailable", {
        description: "The printable report surface is not ready yet.",
      })
      return
    }
    window.print()
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

  if (error || !report) {
    const isFinalizedWithoutApprovedReport = analysis?.status === "COMPLETED"
    return (
      <div className="m-8 flex flex-col items-center justify-center rounded-xl border border-border/60 bg-surface px-8 py-12 text-muted-foreground">
        <AlertCircle className="w-8 h-8 text-destructive mb-3" />
        <p className="font-medium text-foreground">
          {isFinalizedWithoutApprovedReport ? "Approved report snapshot is missing" : "Approved report is not available"}
        </p>
        <p className="max-w-md text-center text-[13px]">
          {isFinalizedWithoutApprovedReport
            ? "This analysis is finalized, but no approved report snapshot was returned by the backend. Re-open the finalized analysis state and confirm approved-report generation completed."
            : "Finalize the analysis after human review to generate the approved traceability report. Draft or unreviewed analysis output is not exported as an approved report."}
        </p>
      </div>
    )
  }

  return (
    <div id={printRootId} className="report-print-root flex flex-col bg-background p-6 md:p-8">
      {/* Report Header Metadata */}
      <div className="mb-10 pb-8 border-b border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{analysis?.requirement.revisionTitle || "Impact Analysis Report"}</h1>
          <div className="flex flex-wrap items-center gap-2 print:hidden shrink-0">
            <Button size="sm" variant="outline" className="h-8 gap-1.5 shadow-none" onClick={handleCopy}>
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy .md'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 shadow-none"
              onClick={handlePrint}
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 shadow-none"
              onClick={() => handleDownload("md")}
              disabled={report.isStale || exportingFormat !== null}
              title={report.isStale ? "Report is stale; rerun/finalize again before export" : undefined}
            >
              {exportingFormat === "md" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export Markdown
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 shadow-none"
              onClick={() => handleDownload("pdf")}
              disabled={report.isStale || exportingFormat !== null}
              title={report.isStale ? "Report is stale; rerun/finalize again before export" : undefined}
            >
              {exportingFormat === "pdf" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export PDF
            </Button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <AnalysisStatusBadge status={report.isStale ? "STALE" : "COMPLETED"} />
        </div>
        
        {report.isStale && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning/25 bg-warning/10 p-4 text-warning">
            <FileWarning className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-[13px] uppercase tracking-wider">Stale Report Warning</span>
              <span className="text-[13px] text-warning/80">
                {report.staleReason || "The repository has progressed past the snapshot used for this report. The findings may no longer be accurate."}
              </span>
              <span className="text-[12px] text-warning/75">
                Reading remains allowed for traceability, but export is blocked until the analysis is rerun and finalized against the current snapshot.
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-y-3 gap-x-6 text-[13px] text-muted-foreground mb-8">
          {analysis?.requirement.id && (
            <div><strong className="text-foreground/80 font-medium">Requirement ID:</strong> <span className="font-mono ml-2">{analysis.requirement.id}</span></div>
          )}
          {analysis?.snapshot.repositoryId && (
            <div><strong className="text-foreground/80 font-medium">Target Repository:</strong> <span className="ml-2">{analysis.snapshot.repositoryId}</span></div>
          )}
          <div><strong className="text-foreground/80 font-medium">Target Commit:</strong> <span className="font-mono ml-2">{report.provenance.commitSha.substring(0, 7)}</span></div>
          <div><strong className="text-foreground/80 font-medium">Generated At:</strong> <span className="ml-2">{new Date(report.provenance.generatedAt).toLocaleDateString()}</span></div>
        </div>
        
        {analysis?.requirement.rawText && (
          <div className="p-4 bg-surface-muted/50 rounded-lg border border-border/50 text-[13px] leading-relaxed text-foreground/90 italic">
            &quot;{analysis.requirement.rawText}&quot;
          </div>
        )}
      </div>

      {/* Markdown Content */}
      <article className="report">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '')
              if (!inline && match && match[1] === 'mermaid') {
                return <MermaidRenderer chart={String(children).replace(/\n$/, '')} />
              }
              if (!inline) {
                return (
                  <pre className="report-pre">
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </pre>
                )
              }
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              )
            },
            table({ children }) {
              return (
                <div className="report-table-wrap">
                  <table>{children}</table>
                </div>
              )
            }
          }}
        >
          {report.markdown}
        </ReactMarkdown>
      </article>
    </div>
  )
}
