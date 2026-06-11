import { useState } from 'react';
import { useClarifications, useEnsureClarification, useAnswerClarification, useDismissClarification, useConvertClarification } from '@/hooks/api/use-clarifications';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { HelpCircle, CheckCircle2, XCircle, MessageSquare } from 'lucide-react';
import { useAnalysisDetail } from '@/hooks/api/use-analyses';
import { NewAnalysisDialog } from './new-analysis-dialog';
import { ClarificationItemDto } from '@ba-helper/contracts';
import { useAuth } from '@/hooks/use-auth';

interface ClarificationWidgetProps {
  analysisId: string;
  insightId: string;
}

export function ClarificationWidget({ analysisId, insightId }: ClarificationWidgetProps) {
  const { data: analysis } = useAnalysisDetail(undefined, analysisId);
  const { data: clarifications, isLoading } = useClarifications(analysisId);
  const ensureMut = useEnsureClarification(analysisId);
  const answerMut = useAnswerClarification(analysisId);
  const dismissMut = useDismissClarification(analysisId);
  const convertMut = useConvertClarification(analysisId);
  const { user } = useAuth();

  const [answerText, setAnswerText] = useState('');
  const [dismissReason, setDismissReason] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const clarification = clarifications?.find((c: ClarificationItemDto) => c.sourceInsightId === insightId);
  const isCompleted = analysis?.status === 'COMPLETED';
  const isViewer = user?.role === 'VIEWER';

  if (isLoading) return null;

  if (!clarification) {
    if (isCompleted) return null;
    return (
      <div className="bg-surface-muted/30 border border-border/50 rounded-lg p-4 flex flex-col items-center justify-center text-center">
        <HelpCircle className="w-8 h-8 text-muted-foreground/60 mb-2" />
        <h4 className="text-sm font-semibold mb-1">Clarification Needed</h4>
        <p className="text-xs text-muted-foreground mb-4 max-w-[240px]">
          Request clarification from BA or QA to resolve this unknown.
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => ensureMut.mutate({ sourceInsightId: insightId })}
          disabled={ensureMut.isPending || isViewer}
          title={isViewer ? "You have view-only access. Reviewer or Admin role required." : undefined}
        >
          {ensureMut.isPending ? 'Requesting...' : 'Request Clarification'}
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
          {clarification.status === 'OPEN' ? 'Clarification Required' : 
           clarification.status === 'ANSWERED' ? 'Clarification Answered' : 
           clarification.status === 'CONVERTED_TO_REVISION' ? 'Converted to Revision' :
           'Clarification Dismissed'}
        </h4>
      </div>

      <div className="space-y-3">
        <div className="text-sm">
          <span className="font-semibold text-muted-foreground">Question:</span>
          <p className="mt-1">{clarification.question}</p>
        </div>

        {clarification.reason && (
          <div className="text-sm">
            <span className="font-semibold text-muted-foreground">Why this matters:</span>
            <p className="mt-1 text-muted-foreground">{clarification.reason}</p>
          </div>
        )}

        {(clarification.status === 'ANSWERED' || clarification.status === 'CONVERTED_TO_REVISION') && (
          <div className="text-sm mt-3 pt-3 border-t border-success/20">
            <span className="font-semibold text-success">Answer:</span>
            <p className="mt-1">{clarification.answer}</p>
          </div>
        )}

        {clarification.status === 'ANSWERED' && (
          <div className="mt-4 pt-3 border-t border-success/20 flex flex-col items-start gap-2">
            <p className="text-xs text-muted-foreground">This answer is recorded. You can convert it into a new requirement revision to run a new analysis.</p>
            <Button 
              size="sm" 
              variant="default"
              disabled={convertMut.isPending || isViewer}
              onClick={() => convertMut.mutate(clarification.id)}
              title={isViewer ? "Admin role required to convert clarification into a requirement revision." : undefined}
            >
              {convertMut.isPending ? 'Converting...' : 'Convert to Requirement Revision'}
            </Button>
          </div>
        )}

        {clarification.status === 'CONVERTED_TO_REVISION' && (
          <div className="mt-4 pt-3 border-t border-success/20 flex flex-col items-start gap-2 bg-success/5 p-3 rounded">
            <p className="text-sm text-foreground">Converted to requirement revision.</p>
            <NewAnalysisDialog
              preselectedReqId={analysis?.requirement.id}
              preselectedRepoId={analysis?.snapshot.repositoryId}
              preselectedReqRevisionId={clarification.convertedRequirementRevisionId ?? undefined}
              derivedFromAnalysisId={analysis?.id}
              sourceClarificationId={clarification.id}
              oldAnalysisSnapshotCommit={analysis?.snapshot.commitSha}
            >
              <Button size="sm" variant="outline">
                Run analysis with this revision
              </Button>
            </NewAnalysisDialog>
          </div>
        )}

        {clarification.status === 'DISMISSED' && (
          <div className="text-sm mt-3 pt-3 border-t border-border/50">
            <span className="font-semibold text-muted-foreground">Disposition:</span>
            <p className="mt-1">Dismissed during review. {clarification.reason ? `Reason: ${clarification.reason}` : ''}</p>
          </div>
        )}

        {clarification.status === 'OPEN' && !isCompleted && (
          <div className="mt-4 flex flex-col gap-3">
            {isAnswering ? (
              <div className="flex flex-col gap-2">
                <Textarea 
                  placeholder="Provide an answer..." 
                  value={answerText}
                  onChange={e => setAnswerText(e.target.value)}
                  className="min-h-[80px] text-sm"
                  disabled={isViewer}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsAnswering(false)}>Cancel</Button>
                  <Button 
                    size="sm" 
                    disabled={!answerText.trim() || answerMut.isPending || isViewer}
                    onClick={() => answerMut.mutate({ id: clarification.id, answer: answerText })}
                    title={isViewer ? "You have view-only access. Reviewer or Admin role required." : undefined}
                  >
                    Submit Answer
                  </Button>
                </div>
              </div>
            ) : isDismissing ? (
              <div className="flex flex-col gap-2">
                <Textarea 
                  placeholder="Reason for dismissal (optional)..." 
                  value={dismissReason}
                  onChange={e => setDismissReason(e.target.value)}
                  className="min-h-[80px] text-sm"
                  disabled={isViewer}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsDismissing(false)}>Cancel</Button>
                  <Button 
                    variant="destructive"
                    size="sm" 
                    disabled={dismissMut.isPending || isViewer}
                    onClick={() => dismissMut.mutate({ id: clarification.id, reason: dismissReason })}
                    title={isViewer ? "You have view-only access. Reviewer or Admin role required." : undefined}
                  >
                    Confirm Dismiss
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-2 border-t border-warning/10">
                <Button size="sm" className="flex-1" onClick={() => setIsAnswering(true)} disabled={isViewer} title={isViewer ? "You have view-only access. Reviewer or Admin role required." : undefined}>
                  Answer
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setIsDismissing(true)} disabled={isViewer} title={isViewer ? "You have view-only access. Reviewer or Admin role required." : undefined}>
                  Dismiss
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
