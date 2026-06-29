import { ReviewedReportSnapshotResponse } from "@ba-helper/contracts"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { EvidenceQualityBadge } from "./evidence-quality-table"
import { ReportMarkdown } from "./report-markdown"
import { parseReviewSnapshotItems } from "./review-snapshot"

interface LockedSnapshotViewerProps {
  snapshot: ReviewedReportSnapshotResponse | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LockedSnapshotViewer({ snapshot, open, onOpenChange }: LockedSnapshotViewerProps) {
  if (!snapshot) return null

  const decisions = parseReviewSnapshotItems(snapshot.reviewDecisionsSnapshot)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] w-[1200px] max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 py-4 border-b border-border/50 shrink-0 bg-surface">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-lg">Locked Snapshot — Read Only</DialogTitle>
            <Badge variant="outline" className="bg-muted text-muted-foreground font-mono text-[10px]">
              {snapshot.id.substring(0, 8)}
            </Badge>
          </div>
          <div className="text-[13px] text-muted-foreground mt-1">
            Snapshot taken at {new Date(snapshot.createdAt).toLocaleString()}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-background p-6 md:p-8 space-y-12">
          <ReportMarkdown markdown={snapshot.markdown || ""} className="opacity-90" />

          {/* Decisions Table */}
          {decisions.length > 0 && (
            <div className="space-y-4 border-t border-border/50 pt-8">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Locked Review Decisions</h3>
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
                      {decisions.map((item, index) => (
                        <tr key={item.itemId ?? item.linkId ?? index} className="hover:bg-muted/30 transition-colors opacity-90">
                          <td className="px-4 py-3 font-mono text-foreground/90 whitespace-nowrap break-all align-top">
                            {item.artifact || 'Unknown'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap align-top">
                            <EvidenceQualityBadge quality={item.quality} />
                          </td>
                          <td className="px-4 py-3 align-top min-w-[120px]">
                            {item.itemType === "INSIGHT" ? (
                              <span className="text-muted-foreground italic">Insight item</span>
                            ) : item.reviewDecision?.decision ? (
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
      </DialogContent>
    </Dialog>
  )
}
