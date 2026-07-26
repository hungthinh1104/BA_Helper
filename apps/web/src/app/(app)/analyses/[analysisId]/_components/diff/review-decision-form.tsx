import { useState } from "react"
import { useTranslations } from "next-intl"
import { CheckCircle2, MessageSquare, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useCreateReviewDecision } from "@/hooks/api/use-analyses"
import { ImpactAnalysisDetailResponse, ProjectRole } from "@ba-helper/contracts"
import { canReview as canReviewPermission } from "@/lib/permissions"

interface ReviewDecisionFormProps {
  analysisId: string
  analysis: ImpactAnalysisDetailResponse
}

export function ReviewDecisionForm({ analysisId, analysis }: ReviewDecisionFormProps) {
  const t = useTranslations("workspace")
  const { user } = useAuth()
  const { mutate: submitDecision, isPending: submitting } = useCreateReviewDecision(analysisId)

  const [decision, setDecision] = useState<"ACCEPTED" | "REJECTED" | "NEEDS_MORE_CLARIFICATION">("ACCEPTED")
  const [note, setNote] = useState("")

  const canReview = Boolean(analysis.capabilities.canReview) && canReviewPermission((user?.role as unknown) as ProjectRole ?? null)

  if (!canReview) return null

  return (
    <div className="flex flex-col gap-4 mt-8 pt-8 border-t border-border/40">
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
          <span>{t("submitDiffReview")}</span>
        </h3>
        <p className="text-xs text-muted-foreground mt-1">{t("submitDiffReviewDescription")}</p>
      </div>
      <div className="flex flex-col gap-4 p-5 rounded-xl border border-border/40 bg-surface-muted/30">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => setDecision("ACCEPTED")}
            className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
              decision === "ACCEPTED"
                ? "border-success bg-success/10 ring-1 ring-success/20"
                : "border-border/60 bg-surface hover:bg-surface-soft"
            }`}
          >
            <CheckCircle2 className={`w-4 h-4 ${decision === "ACCEPTED" ? "text-success" : "text-muted-foreground"}`} />
            <div className="flex flex-col">
              <span className={`text-[13px] font-medium ${decision === "ACCEPTED" ? "text-success" : "text-foreground"}`}>{t("accept")}</span>
              <span className="text-[11px] text-muted-foreground">{t("changesLookGood")}</span>
            </div>
          </button>

          <button
            onClick={() => setDecision("NEEDS_MORE_CLARIFICATION")}
            className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
              decision === "NEEDS_MORE_CLARIFICATION"
                ? "border-warning bg-warning/10 ring-1 ring-warning/20"
                : "border-border/60 bg-surface hover:bg-surface-soft"
            }`}
          >
            <MessageSquare className={`w-4 h-4 ${decision === "NEEDS_MORE_CLARIFICATION" ? "text-warning" : "text-muted-foreground"}`} />
            <div className="flex flex-col">
              <span className={`text-[13px] font-medium ${decision === "NEEDS_MORE_CLARIFICATION" ? "text-warning" : "text-foreground"}`}>{t("requestInfo")}</span>
              <span className="text-[11px] text-muted-foreground">{t("needClarification")}</span>
            </div>
          </button>

          <button
            onClick={() => setDecision("REJECTED")}
            className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
              decision === "REJECTED"
                ? "border-danger bg-danger/10 ring-1 ring-danger/20"
                : "border-border/60 bg-surface hover:bg-surface-soft"
            }`}
          >
            <AlertCircle className={`w-4 h-4 ${decision === "REJECTED" ? "text-danger" : "text-muted-foreground"}`} />
            <div className="flex flex-col">
              <span className={`text-[13px] font-medium ${decision === "REJECTED" ? "text-danger" : "text-foreground"}`}>{t("reject")}</span>
              <span className="text-[11px] text-muted-foreground">{t("changesInvalid")}</span>
            </div>
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("reviewNoteOptional")}</label>
          <Textarea 
            placeholder={t("reviewDecisionCommentPlaceholder")}
            className="min-h-[100px] text-[13px] resize-none"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="flex justify-end pt-2 border-t border-border/40">
          <Button
            onClick={() => submitDecision({ data: { decision, note } })}
            disabled={submitting}
            className={`h-9 shadow-none text-[13px] px-6 ${
              decision === "ACCEPTED" ? "bg-success hover:bg-success/90 text-white" :
              decision === "NEEDS_MORE_CLARIFICATION" ? "bg-warning hover:bg-warning/90 text-warning-foreground" :
              "bg-danger hover:bg-danger/90 text-white"
            }`}
          >
            {submitting ? t("submitting") : t("submitReview")}
          </Button>
        </div>
      </div>
    </div>
  )
}
