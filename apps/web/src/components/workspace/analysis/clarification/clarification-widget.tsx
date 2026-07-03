import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useClarifications, useEnsureClarification, useAnswerClarification, useDismissClarification, useConvertClarification } from '@/hooks/api/use-clarifications';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { HelpCircle, CheckCircle2, XCircle, MessageSquare } from 'lucide-react';
import { useAnalysisDetail } from '@/hooks/api/use-analyses';
import { NewAnalysisDialog } from "@/components/workspace/analysis/new-analysis/new-analysis-dialog";
import { ClarificationItemDto } from '@ba-helper/contracts';
import { useCurrentWorkspace } from '@/lib/project-context';
import { canWriteClarification, canCreateRequirement } from '@/lib/permissions';

interface ClarificationWidgetProps {
  analysisId: string;
  insightId: string;
}

export function ClarificationWidget({ analysisId, insightId }: ClarificationWidgetProps) {
  const t = useTranslations("workspace")
  const { data: analysis } = useAnalysisDetail(analysisId);
  const { data: clarifications, isLoading } = useClarifications(analysisId);
  const ensureMut = useEnsureClarification(analysisId);
  const answerMut = useAnswerClarification(analysisId);
  const dismissMut = useDismissClarification(analysisId);
  const convertMut = useConvertClarification(analysisId);

  const [answerText, setAnswerText] = useState('');
  const [dismissReason, setDismissReason] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const clarification = clarifications?.find((c: ClarificationItemDto) => c.sourceInsightId === insightId);
  const isCompleted = analysis?.status === 'COMPLETED';
  const workspace = useCurrentWorkspace();
  const canWrite = workspace ? canWriteClarification(workspace.membershipRole) : false;
  const canConvert = workspace ? canCreateRequirement(workspace.membershipRole) : false;

  if (isLoading) return null;

  if (!clarification) {
    if (isCompleted) return null;
    return (
      <div className="bg-surface-muted/30 border border-border/50 rounded-lg p-4 flex flex-col items-center justify-center text-center">
        <HelpCircle className="w-8 h-8 text-muted-foreground/60 mb-2" />
        <h4 className="text-sm font-semibold mb-1">{t("clarificationNeeded")}</h4>
        <p className="text-xs text-muted-foreground mb-4 max-w-[240px]">
          {t("clarificationNeededDescription")}
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => ensureMut.mutate({ sourceInsightId: insightId })}
          disabled={ensureMut.isPending || !canWrite}
          title={!canWrite ? t("reviewerOrAnalystRequired") : undefined}
        >
          {ensureMut.isPending ? t("requesting") : t("requestClarification")}
        </Button>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-4 ${
      clarification.status === 'OPEN' ? 'bg-warning/5 border-warning/20' : 
      clarification.status === 'ANSWERED' ? 'bg-success/5 border-success/20' : 
      'bg-surface-muted/30 border-border/50'
    }`}>
      <div className="flex items-center gap-2 mb-3">
        {clarification.status === 'OPEN' && <MessageSquare className="w-4 h-4 text-warning" />}
        {clarification.status === 'ANSWERED' && <CheckCircle2 className="w-4 h-4 text-success" />}
        {clarification.status === 'CONVERTED_TO_REVISION' && <CheckCircle2 className="w-4 h-4 text-success" />}
        {clarification.status === 'DISMISSED' && <XCircle className="w-4 h-4 text-muted-foreground" />}
        
        <h4 className="text-sm font-semibold">
          {clarification.status === 'OPEN' ? t("clarificationRequired") :
           clarification.status === 'ANSWERED' ? t("clarificationAnswered") :
           clarification.status === 'CONVERTED_TO_REVISION' ? t("convertedToRevision") :
           t("clarificationDismissed")}
        </h4>
      </div>

      <div className="space-y-3">
        <div className="text-sm">
          <span className="font-semibold text-muted-foreground">{t("question")}:</span>
          <p className="mt-1">{clarification.question}</p>
        </div>

        {clarification.reason && (
          <div className="text-sm">
            <span className="font-semibold text-muted-foreground">{t("whyThisMatters")}:</span>
            <p className="mt-1 text-muted-foreground">{clarification.reason}</p>
          </div>
        )}

        {(clarification.status === 'ANSWERED' || clarification.status === 'CONVERTED_TO_REVISION') && (
          <div className="text-sm mt-3 pt-3 border-t border-success/20">
            <span className="font-semibold text-success">{t("answer")}:</span>
            <p className="mt-1">{clarification.answer}</p>
          </div>
        )}

        {clarification.status === 'ANSWERED' && (
          <div className="mt-4 pt-3 border-t border-success/20 flex flex-col items-start gap-2">
            <p className="text-xs text-muted-foreground">{t("answerRecordedDescription")}</p>
            <Button 
              size="sm" 
              variant="default"
              disabled={convertMut.isPending || !canConvert}
              onClick={() => convertMut.mutate(clarification.id)}
              title={!canConvert ? t("analystRequiredConvertClarification") : undefined}
            >
              {convertMut.isPending ? t("converting") : t("convertToRequirementRevision")}
            </Button>
          </div>
        )}

        {clarification.status === 'CONVERTED_TO_REVISION' && (
          <div className="mt-4 pt-3 border-t border-success/20 flex flex-col items-start gap-2 bg-success/5 p-3 rounded">
            <p className="text-sm text-foreground">{t("convertedToRequirementRevision")}</p>
            <NewAnalysisDialog
              preselectedReqId={analysis?.requirement.id}
              preselectedRepoId={analysis?.snapshot.repositoryId}
              preselectedReqRevisionId={clarification.convertedRequirementRevisionId ?? undefined}
              derivedFromAnalysisId={analysis?.id}
              sourceClarificationId={clarification.id}
              oldAnalysisSnapshotCommit={analysis?.snapshot.commitSha}
            >
              <Button size="sm" variant="outline">
                {t("runAnalysisWithRevision")}
              </Button>
            </NewAnalysisDialog>
          </div>
        )}

        {clarification.status === 'DISMISSED' && (
          <div className="text-sm mt-3 pt-3 border-t border-border/50">
            <span className="font-semibold text-muted-foreground">{t("disposition")}:</span>
            <p className="mt-1">
              {t("dismissedDuringReview")}
              {clarification.reason ? ` ${t("reason")}: ${clarification.reason}` : ''}
            </p>
          </div>
        )}

        {clarification.status === 'OPEN' && !isCompleted && (
          <div className="mt-4 flex flex-col gap-3">
            {isAnswering ? (
              <div className="flex flex-col gap-2">
                <Textarea 
                  placeholder={t("provideAnswerPlaceholder")}
                  value={answerText}
                  onChange={e => setAnswerText(e.target.value)}
                  className="min-h-[80px] text-sm"
                  disabled={!canWrite}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsAnswering(false)}>{t("cancel")}</Button>
                  <Button 
                    size="sm" 
                    disabled={!answerText.trim() || answerMut.isPending || !canWrite}
                    onClick={() => answerMut.mutate({ id: clarification.id, answer: answerText })}
                    title={!canWrite ? t("reviewerOrAnalystRequired") : undefined}
                  >
                    {t("submitAnswer")}
                  </Button>
                </div>
              </div>
            ) : isDismissing ? (
              <div className="flex flex-col gap-2">
                <Textarea 
                  placeholder={t("dismissReasonPlaceholder")}
                  value={dismissReason}
                  onChange={e => setDismissReason(e.target.value)}
                  className="min-h-[80px] text-sm"
                  disabled={!canWrite}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsDismissing(false)}>{t("cancel")}</Button>
                  <Button 
                    variant="destructive"
                    size="sm" 
                    disabled={dismissMut.isPending || !canWrite}
                    onClick={() => dismissMut.mutate({ id: clarification.id, reason: dismissReason })}
                    title={!canWrite ? t("reviewerOrAnalystRequired") : undefined}
                  >
                    {t("confirmDismiss")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-2 border-t border-warning/10">
                <Button size="sm" className="flex-1" onClick={() => setIsAnswering(true)} disabled={!canWrite} title={!canWrite ? t("reviewerOrAnalystRequired") : undefined}>
                  {t("answer")}
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setIsDismissing(true)} disabled={!canWrite} title={!canWrite ? t("reviewerOrAnalystRequired") : undefined}>
                  {t("dismiss")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
