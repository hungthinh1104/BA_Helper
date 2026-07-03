import { useState } from "react"
import { useTranslations } from "next-intl"
import { useReviewClarifications, useCreateReviewClarification, useAnswerReviewClarification, useCreateDerivedAnalysisFromClarification } from "@/hooks/api/use-analyses"
import { useCurrentWorkspace } from "@/lib/project-context"
import { canWriteClarification } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { HelpCircle, ArrowRight, CornerDownRight, CheckCircle2 } from "lucide-react"
import type { ReviewDecisionResponse } from "@ba-helper/contracts"

export function AnalysisClarificationBlock({ analysisId, latestDecision }: { analysisId: string, latestDecision?: ReviewDecisionResponse }) {
  const t = useTranslations("workspace")
  const { data: clarificationsData, isLoading } = useReviewClarifications(analysisId)
  const createClarification = useCreateReviewClarification(analysisId)
  const answerClarification = useAnswerReviewClarification(analysisId)
  const createDerivedAnalysis = useCreateDerivedAnalysisFromClarification(analysisId)
  const workspace = useCurrentWorkspace()
  const canWrite = workspace ? canWriteClarification(workspace.membershipRole) : false
  const isViewer = !canWrite

  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")

  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-xl" />
  }

  const isClarificationNeeded = latestDecision?.decision === 'NEEDS_MORE_CLARIFICATION'
  const clarifications = clarificationsData?.items || []
  
  // Find active clarification (either OPEN or ANSWERED without derived analysis)
  // Actually, we just look at the most recent one for this analysis.
  const activeClarification = clarifications.find(c => c.status !== 'CANCELLED')

  if (!isClarificationNeeded && !activeClarification) {
    return null
  }

  const handleCreateClarification = async () => {
    if (!latestDecision) return
    try {
      await createClarification.mutateAsync({
        data: {
          reviewDecisionId: latestDecision.id,
          question,
        }
      })
      toast.success(t("clarificationRequestSent"))
      setQuestion("")
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || t("failedCreateClarification"))
    }
  }

  const handleAnswerClarification = async (clarificationId: string) => {
    try {
      await answerClarification.mutateAsync({
        clarificationId,
        data: { answer }
      })
      toast.success(t("clarificationAnsweredToast"))
      setAnswer("")
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || t("failedAnswerClarification"))
    }
  }

  const handleCreateDerivedAnalysis = async (clarificationId: string) => {
    try {
      await createDerivedAnalysis.mutateAsync(clarificationId)
      toast.success(t("derivedAnalysisCreated"))
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || t("failedCreateDerivedAnalysis"))
    }
  }

  return (
    <div className="flex flex-col gap-4 mt-6 p-5 rounded-xl border border-warning/30 bg-warning/5 text-sm">
      <div className="flex items-center gap-2 mb-2 text-warning font-semibold">
        <HelpCircle className="w-5 h-5" />
        <h3>{t("clarificationWorkflow")}</h3>
      </div>
      
      {!activeClarification && isClarificationNeeded && (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-xs">{t("latestReviewNeedsClarification")}</p>
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            disabled={isViewer}
            placeholder={isViewer ? t("clarificationDisabledViewer") : t("enterClarificationQuestion")}
            className={`w-full min-h-[80px] p-3 rounded-lg bg-surface border border-border/60 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-warning focus:border-warning resize-y ${isViewer ? 'opacity-50 cursor-not-allowed bg-surface-muted' : ''}`}
            title={isViewer ? t("viewOnlyReviewerAdminRequired") : undefined}
          />
          <div className="flex justify-end">
            <Button 
              onClick={handleCreateClarification} 
              disabled={!question.trim() || createClarification.isPending || isViewer}
              className="bg-warning hover:bg-warning/90 text-warning-foreground h-8 text-xs"
              title={isViewer ? t("viewOnlyReviewerAdminRequired") : undefined}
            >
              {t("requestClarification")}
            </Button>
          </div>
        </div>
      )}

      {activeClarification && activeClarification.status === 'OPEN' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 p-3 rounded-lg bg-surface/50 border border-border/40">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("question")}</span>
            <span className="text-[13px] text-foreground whitespace-pre-wrap">{activeClarification.question}</span>
          </div>
          
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <CornerDownRight className="w-3.5 h-3.5" /> {t("stakeholderAnswer")}
            </span>
            <textarea 
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={!canWrite}
              placeholder={!canWrite ? t("answerClarificationDisabledViewer") : t("enterStakeholderAnswer")}
              className={`w-full min-h-[80px] p-3 rounded-lg bg-surface border border-border/60 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-y ${!canWrite ? 'opacity-50 cursor-not-allowed bg-surface-muted' : ''}`}
              title={!canWrite ? t("viewOnlyReviewerAnalystRequired") : undefined}
            />
            <div className="flex justify-end mt-1">
              <Button 
                onClick={() => handleAnswerClarification(activeClarification.id)} 
                disabled={!answer.trim() || answerClarification.isPending || !canWrite}
                className="h-8 text-xs"
                title={!canWrite ? t("analystReviewerRequired") : undefined}
              >
                {t("submitAnswer")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeClarification && activeClarification.status === 'ANSWERED' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 p-3 rounded-lg bg-surface/50 border border-border/40">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("question")}</span>
            <span className="text-[13px] text-foreground whitespace-pre-wrap">{activeClarification.question}</span>
          </div>
          
          <div className="flex flex-col gap-1 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1">
              <CornerDownRight className="w-3.5 h-3.5" /> {t("answer")}
            </span>
            <span className="text-[13px] text-foreground whitespace-pre-wrap">{activeClarification.answer}</span>
          </div>

          <div className="flex items-center justify-between mt-2 pt-4 border-t border-warning/20">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span className="text-sm font-medium">{t("clarificationResolved")}</span>
            </div>
            
            {activeClarification.derivedAnalyses && activeClarification.derivedAnalyses.length > 0 ? (
              <a 
                href={`/analyses/${activeClarification.derivedAnalyses[0].id}`}
                className="inline-flex items-center justify-center rounded-lg border border-primary text-primary hover:bg-primary/5 h-8 px-3 text-xs font-medium transition-colors"
              >
                {t("viewDerivedAnalysis")} <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </a>
            ) : (
              <Button 
                onClick={() => handleCreateDerivedAnalysis(activeClarification.id)} 
                disabled={createDerivedAnalysis.isPending || isViewer}
                className="h-8 text-xs bg-primary hover:bg-primary/90 text-white"
                title={isViewer ? t("viewOnlyReviewerAdminRequired") : undefined}
              >
                {t("createDerivedAnalysis")}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
