import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { MessageSquareWarning, ShieldCheck, XCircle } from "lucide-react"
import type { MergedMultiRepoReportReviewDecisionResponse } from "@ba-helper/contracts"

interface MergedReportReviewPanelProps {
  isStale: boolean
  latestReviewedDecision: MergedMultiRepoReportReviewDecisionResponse | null | undefined
  reviewDecisions: MergedMultiRepoReportReviewDecisionResponse[]
  reviewDecisionsLoading: boolean
  canReview: boolean
  hasReviewPermission: boolean
  isSubmitting: boolean
  onSubmitReview: (data: { decision: "ACCEPTED" | "REJECTED" | "NEEDS_MORE_CLARIFICATION"; note: string }) => void
}

export function MergedReportReviewPanel({
  isStale,
  latestReviewedDecision,
  reviewDecisions,
  reviewDecisionsLoading,
  canReview,
  hasReviewPermission,
  isSubmitting,
  onSubmitReview,
}: MergedReportReviewPanelProps) {
  const [decision, setDecision] = useState<"ACCEPTED" | "REJECTED" | "NEEDS_MORE_CLARIFICATION" | null>(null)
  const [note, setNote] = useState("")

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!decision) return
    onSubmitReview({ decision, note })
    // The parent controls the mutation. We could clear the form here, but usually it's better to clear it when the parent mutation succeeds. 
    // For simplicity, since the parent handles toast on success, we can just let parent clear it if we passed a callback or just clear it optimistically.
    // The user requested: "Page giữ mutation handlers, panel chỉ render form và gọi callback."
    // Let's assume parent doesn't reset form state inside panel directly, so we reset on submit.
    setDecision(null)
    setNote("")
  }

  return (
    <section className="mb-6 rounded-xl border border-border/50 bg-surface-muted/20 p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Merged Report Review</h2>
          <p className="text-[12px] text-muted-foreground">
            Append-only decision history for the approved merged report snapshot.
          </p>
        </div>
        {!isStale && latestReviewedDecision && (
          <div className="text-right text-[12px] text-muted-foreground">
            <div>Latest decision by {latestReviewedDecision.reviewedBy}</div>
            <div>{new Date(latestReviewedDecision.createdAt).toLocaleString("en-US")}</div>
          </div>
        )}
      </div>

      {isStale && (
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[12px] text-warning">
          Review submission is blocked while the approved merged report is stale. Refresh and approve the snapshot again first.
        </div>
      )}

      <div className="mb-4 space-y-2">
        {reviewDecisionsLoading && <Skeleton className="h-16 w-full" />}
        {!reviewDecisionsLoading && reviewDecisions.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-[12px] text-muted-foreground">
            No merged report review decisions yet.
          </div>
        )}
        {reviewDecisions.map((item) => (
          <div key={item.id} className="rounded-lg border border-border/50 bg-background/60 px-3 py-3">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px]">
              <Badge
                variant={
                  item.decision === "ACCEPTED"
                    ? "default"
                    : item.decision === "REJECTED"
                      ? "destructive"
                      : "secondary"
                }
              >
                {item.decision}
              </Badge>
              <span className="text-muted-foreground">by {item.reviewedBy}</span>
              <span className="text-muted-foreground">{new Date(item.createdAt).toLocaleString("en-US")}</span>
            </div>
            {item.note && (
              <p className="text-[13px] text-foreground whitespace-pre-wrap">{item.note}</p>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {[
            { value: "ACCEPTED", label: "Accept", icon: ShieldCheck },
            { value: "REJECTED", label: "Reject", icon: XCircle },
            { value: "NEEDS_MORE_CLARIFICATION", label: "Needs Clarification", icon: MessageSquareWarning },
          ].map((option) => {
            const Icon = option.icon
            const selected = decision === option.value
            return (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={selected ? "default" : "outline"}
                className="h-8 shadow-none"
                onClick={() => setDecision(option.value as typeof decision)}
                disabled={!canReview || isSubmitting}
              >
                <Icon className="w-3.5 h-3.5" />
                {option.label}
              </Button>
            )
          })}
        </div>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional review note"
          maxLength={2000}
          disabled={!canReview || isSubmitting}
          className="min-h-24"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] text-muted-foreground">
            {canReview
              ? "Review decisions are append-only. Existing entries are preserved."
              : !hasReviewPermission
                ? "You have view-only access. Reviewer or Analyst role required."
                : "Only admin/reviewer review posture can submit merged report decisions in the current UI."}
          </span>
          <Button
            type="submit"
            size="sm"
            className="h-8 shadow-none"
            disabled={!canReview || isSubmitting || !decision}
            title={
              isStale
                ? "Refresh and approve the merged report again before submitting a new review decision."
                : !decision
                  ? "Select a decision first."
                  : undefined
            }
          >
            {isSubmitting ? "Submitting..." : "Submit review"}
          </Button>
        </div>
      </form>
    </section>
  )
}
