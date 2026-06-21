import { useFinalReviewedReport } from "@/hooks/api/use-final-reviewed-report"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { MermaidRenderer } from "@/components/workspace/shared/mermaid-renderer"
import { Badge } from "@/components/ui/badge"
import { EvidenceQualityBadge } from "./evidence-quality-table"
import { AlertCircle, Loader2 } from "lucide-react"

interface FinalReviewedReportViewerProps {
  analysisId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FinalReviewedReportViewer({ analysisId, open, onOpenChange }: FinalReviewedReportViewerProps) {
  const { data: finalReport, isLoading, error } = useFinalReviewedReport(analysisId, { enabled: open })

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p>Loading final audited report...</p>
        </div>
      )
    }

    if (error || !finalReport) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-destructive p-12">
          <AlertCircle className="w-8 h-8 mb-4" />
          <p>Failed to load final report.</p>
          <p className="text-sm mt-2 opacity-80">
            {error instanceof Error ? error.message : "Ensure all reviews are complete."}
          </p>
        </div>
      )
    }

    const decisions = Array.isArray(finalReport.reviewDecisionsSnapshot) 
      ? finalReport.reviewDecisionsSnapshot 
      : []

    return (
      <div className="flex-1 overflow-y-auto bg-background p-6 md:p-8 space-y-12">
        {/* Read Only Markdown */}
        <article className="report opacity-95">
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
            {finalReport.markdown}
          </ReactMarkdown>
        </article>

        {/* Decisions Table */}
        {decisions.length > 0 && (
          <div className="space-y-4 border-t border-border/50 pt-8">
            <h3 className="text-base font-semibold text-foreground tracking-tight">Final Review Decisions</h3>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px] border-collapse">
                  <thead className="bg-surface-muted border-b border-border/50 text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">Artifact</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">Quality at Snapshot</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">Review Decision</th>
                      <th className="px-4 py-3 font-medium">Note</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">Reviewed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 bg-surface">
                    {decisions.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors opacity-95">
                        <td className="px-4 py-3 font-mono text-foreground/90 whitespace-nowrap break-all align-top">
                          {item.artifact || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap align-top">
                          <EvidenceQualityBadge quality={item.quality} />
                        </td>
                        <td className="px-4 py-3 align-top min-w-[120px]">
                          {item.reviewDecision?.decision ? (
                            <Badge variant="outline" className="rounded-sm px-2 py-0.5 text-[11px] font-mono tracking-wide border-border/50 text-foreground/80">
                              {item.reviewDecision.decision.replace(/_/g, " ")}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground italic">No Decision</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground align-top max-w-[300px] break-words">
                          {item.reviewDecision?.note || "-"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground align-top whitespace-nowrap">
                          {item.reviewDecision?.reviewedAt ? new Date(item.reviewDecision.reviewedAt).toLocaleString() : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] w-[1200px] max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 py-4 border-b border-border/50 shrink-0 bg-surface">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-lg">Final Reviewed Report — Read Only</DialogTitle>
            {finalReport && (
              <Badge variant="default" className="bg-primary/20 text-primary hover:bg-primary/30 border-primary/30 font-mono text-[10px]">
                {finalReport.snapshotId.substring(0, 8)}
              </Badge>
            )}
          </div>
          {finalReport && (
            <div className="text-[13px] text-muted-foreground mt-1">
              Audited at {new Date(finalReport.createdAt).toLocaleString()}
            </div>
          )}
        </DialogHeader>

        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}
