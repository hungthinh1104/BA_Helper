"use client"

import { useApprovedReport } from "@/hooks/api/use-approved-report"
import { useAnalysisDetail } from "@/hooks/api/use-analyses"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, FileWarning } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface ReportViewerProps {
  analysisId: string;
  commitSha: string;
  generatedAt: string;
}

export function ReportViewer({ analysisId, commitSha, generatedAt }: ReportViewerProps) {
  const { data: analysis, isLoading: analysisLoading } = useAnalysisDetail("default-project", analysisId)
  const { data: report, isLoading: reportLoading, error } = useApprovedReport(analysisId)

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
        <h1 className="text-2xl font-bold mb-6 text-foreground tracking-tight">{analysis?.requirement.revisionTitle || "Impact Analysis Report"}</h1>
        
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
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {report.markdown}
        </ReactMarkdown>
      </article>
    </div>
  )
}
