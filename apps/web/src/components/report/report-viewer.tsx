"use client"

import { useApprovedReport } from "@/hooks/api/use-approved-report"
import { useAnalysisDetail } from "@/hooks/api/use-analyses"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, FileWarning, Copy, Download, CheckCircle2 } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { MermaidRenderer } from "@/components/workspace/mermaid-renderer"
import remarkGfm from "remark-gfm"

interface ReportViewerProps {
  analysisId: string;
  commitSha: string;
  generatedAt: string;
}

export function ReportViewer({ analysisId, commitSha, generatedAt }: ReportViewerProps) {
  const { data: analysis, isLoading: analysisLoading } = useAnalysisDetail(undefined, analysisId)
  const { data: report, isLoading: reportLoading, error } = useApprovedReport(analysisId, analysis?.status)
  const [copied, setCopied] = useState(false)

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

  const handleDownload = () => {
    if (!report?.markdown) return;
    const blob = new Blob([report.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `impact-report-${analysisId.substring(0, 8)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground border rounded-xl bg-surface-muted/30 m-8">
        <AlertCircle className="w-8 h-8 text-destructive mb-3" />
        <p className="font-medium text-foreground">Failed to load report</p>
        <p className="text-[13px]">The approved report for this analysis could not be retrieved or has not been generated.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col p-6 md:p-8">
      {/* Report Header Metadata */}
      <div className="mb-10 pb-8 border-b border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{analysis?.requirement.revisionTitle || "Impact Analysis Report"}</h1>
          <div className="flex items-center gap-2 print:hidden shrink-0">
            <Button size="sm" variant="outline" className="h-8 gap-1.5 shadow-none" onClick={handleCopy}>
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy .md'}
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 shadow-none" onClick={handleDownload}>
              <Download className="w-3.5 h-3.5" />
              Download .md
            </Button>
          </div>
        </div>
        
        {report.isStale && (
          <div className="flex items-start gap-3 p-4 mb-6 bg-warning/10 border border-warning/25 rounded-lg text-warning">
            <FileWarning className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-[13px] uppercase tracking-wider">Stale Report Warning</span>
              <span className="text-[13px] text-warning/80">
                {report.staleReason || "The repository has progressed past the snapshot used for this report. The findings may no longer be accurate."}
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
          <div><strong className="text-foreground/80 font-medium">Target Commit:</strong> <span className="font-mono ml-2">{commitSha.substring(0, 7)}</span></div>
          <div><strong className="text-foreground/80 font-medium">Generated At:</strong> <span className="ml-2">{new Date(generatedAt).toLocaleDateString()}</span></div>
        </div>
        
        {analysis?.requirement.rawText && (
          <div className="p-4 bg-surface-muted/50 rounded-lg border border-border/50 text-[13px] leading-relaxed text-foreground/90 italic">
            &quot;{analysis.requirement.rawText}&quot;
          </div>
        )}
      </div>

      {/* Markdown Content */}
      <article className="prose prose-sm md:prose-base prose-zinc dark:prose-invert max-w-none prose-headings:tracking-tight prose-a:text-primary">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '')
              if (!inline && match && match[1] === 'mermaid') {
                return <MermaidRenderer chart={String(children).replace(/\n$/, '')} />
              }
              return (
                <code className={className} {...props}>
                  {children}
                </code>
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
