import { ShieldCheck, CheckCircle2, MessageSquare, AlertCircle } from "lucide-react"
import { ReviewDecisionResponse } from "@ba-helper/contracts"

interface ReviewHistoryListProps {
  decisions: ReviewDecisionResponse[]
}

export function ReviewHistoryList({ decisions }: ReviewHistoryListProps) {
  if (decisions.length === 0) return null

  const getRelativeTime = (dateString: string) => {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const diff = new Date(dateString).getTime() - new Date().getTime();
    const diffDays = Math.round(diff / (1000 * 60 * 60 * 24));
    if (Math.abs(diffDays) > 0) return rtf.format(diffDays, 'day');
    const diffHours = Math.round(diff / (1000 * 60 * 60));
    if (Math.abs(diffHours) > 0) return rtf.format(diffHours, 'hour');
    const diffMinutes = Math.round(diff / (1000 * 60));
    return rtf.format(diffMinutes, 'minute');
  };

  return (
    <div className="flex flex-col gap-4 mt-8 pt-8 border-t border-border/40">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-muted-foreground" />
        <span>Diff Review History</span>
      </h3>
      <div className="flex flex-col gap-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border/50 before:to-transparent">
        {decisions.map((decision) => (
          <div key={decision.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-surface-muted shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10">
              {decision.decision === "ACCEPTED" ? (
                <CheckCircle2 className="w-4 h-4 text-success" />
              ) : decision.decision === "NEEDS_MORE_CLARIFICATION" ? (
                <MessageSquare className="w-4 h-4 text-warning" />
              ) : (
                <AlertCircle className="w-4 h-4 text-danger" />
              )}
            </div>

            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-border/40 bg-surface/50 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-foreground">
                    {decision.decision === "ACCEPTED" ? "Accepted" : 
                     decision.decision === "NEEDS_MORE_CLARIFICATION" ? "Clarification Requested" : "Rejected"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    by {decision.reviewedBy} · {getRelativeTime(decision.createdAt)}
                  </span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface border border-border text-muted-foreground">
                  {decision.id.slice(0, 8)}
                </span>
              </div>
              {decision.note && (
                <p className="text-xs text-muted-foreground bg-surface-muted/30 p-2.5 rounded border border-border/50 mt-2 whitespace-pre-wrap">
                  {decision.note}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
