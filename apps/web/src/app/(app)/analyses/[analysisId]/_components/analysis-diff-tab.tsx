"use client"

import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useAnalysisDiff, useReviewDecisions, useCreateReviewDecision } from "@/hooks/api/use-analyses"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import type { ImpactAnalysisResponse } from "@ba-helper/contracts"
import { useState } from "react"
import {
  AlertTriangle,
  History,
  Plus,
  Minus,
  Check,
  FileCode,
  HelpCircle,
  ShieldCheck,
  ArrowRight,
  User,
  Calendar,
  Send,
  ThumbsUp,
  ThumbsDown,
  Info
} from "lucide-react"
import { AnalysisClarificationBlock } from "./analysis-clarification-block"

interface AnalysisDiffTabProps {
  analysisId: string
  analysis: ImpactAnalysisResponse
}

export function AnalysisDiffTab({ analysisId, analysis }: AnalysisDiffTabProps) {
  const router = useRouter()
  const { data: diff, isLoading, error } = useAnalysisDiff(analysisId)
  const { data: decisionsData, isLoading: decisionsLoading } = useReviewDecisions(analysisId)
  const createDecision = useCreateReviewDecision(analysisId)
  const { user } = useAuth()

  const [decision, setDecision] = useState<'ACCEPTED' | 'REJECTED' | 'NEEDS_MORE_CLARIFICATION' | null>(null)
  const [note, setNote] = useState("")

  const isViewer = user?.role === 'VIEWER'

  const diffComputable = !error && !!diff
  
  const errorObj = error as Error | { message?: string, response?: { data?: { message?: string } } } | null
  const errorMessage = errorObj?.message || (errorObj && 'response' in errorObj && errorObj.response?.data?.message) || "An error occurred while computing the difference."

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!decision) {
      toast.error("Please select a review decision")
      return
    }
    
    if (decision === 'ACCEPTED' && !diffComputable) {
      toast.error("An analysis cannot be accepted if the difference report is unavailable.")
      return
    }

    try {
      await createDecision.mutateAsync({
        data: {
          decision,
          note: note.trim() || undefined,
        },
      })
      toast.success("Review decision submitted successfully")
      setDecision(null)
      setNote("")
    } catch (err: unknown) {
      const errorDetails = err as Error | { message?: string, response?: { data?: { message?: string } } }
      const msg = errorDetails?.message || (errorDetails && 'response' in errorDetails && errorDetails.response?.data?.message) || "Failed to submit review decision"
      toast.error(msg)
    }
  }

  if (isLoading) {
    return (
      <div className="mt-4 flex flex-col gap-6 max-w-4xl pb-12">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  const decisions = decisionsData?.items || []

  return (
    <div className="mt-4 flex flex-col gap-6 max-w-4xl pb-12">
      {/* Error/Unavailable Banner */}
      {!diffComputable && (
        <div className="flex flex-col gap-3 p-4 rounded-xl border border-warning/30 bg-warning/5 text-warning-foreground text-[13px] leading-relaxed">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 shrink-0 text-warning mt-0.5" />
            <div>
              <span className="font-semibold text-foreground mr-1.5">Diff Computation Unavailable:</span>
              {errorMessage}
            </div>
          </div>
          <div className="text-xs text-muted-foreground pl-7">
            You cannot accept this derived analysis because the difference report could not be computed. However, you can still reject it or request further clarification.
          </div>
        </div>
      )}

      {/* Computed Diff View */}
      {diffComputable && diff && (
        <>
          {/* Diagnostics */}
          {diff.diagnostics && diff.diagnostics.length > 0 && (
            <div className="flex flex-col gap-3">
              {diff.diagnostics.map((diag, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3.5 rounded-lg border border-warning/30 bg-warning/5 text-warning-foreground text-[13px] leading-relaxed"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 text-warning mt-0.5" />
                  <div>
                    <span className="font-semibold text-foreground mr-1.5">Warning:</span>
                    {diag.message}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Comparison Context Header Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/40 bg-surface/30">
            <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground uppercase tracking-wider text-[10px]">Context:</span>
                {diff.comparisonContext.requirementChanged ? (
                  <span className="px-1.5 py-0.5 rounded bg-info/10 text-info border border-info/20 text-[10px]">Requirement Updated</span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded bg-surface border border-border text-[10px]">Same Requirement</span>
                )}
                {diff.comparisonContext.snapshotChanged ? (
                  <span className="px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/20 text-[10px]">Code Changed</span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20 text-[10px]">Identical Codebase</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px]">
                <span>Baseline revision:</span>
                <code className="text-foreground bg-surface border border-border px-1 rounded text-[10px]">{diff.comparisonContext.baseRequirementRevisionId.slice(0, 8)}</code>
                <ArrowRight className="w-3 h-3 text-muted-foreground/60" />
                <span>Current:</span>
                <code className="text-foreground bg-surface border border-border px-1 rounded text-[10px]">{diff.comparisonContext.currentRequirementRevisionId.slice(0, 8)}</code>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                <span>Baseline snapshot:</span>
                <code className="text-foreground bg-surface border border-border px-1 rounded text-[10px]">{diff.comparisonContext.baseCommitSha?.slice(0, 7) ?? "N/A"}</code>
                <ArrowRight className="w-3 h-3 text-muted-foreground/60" />
                <span>Current:</span>
                <code className="text-foreground bg-surface border border-border px-1 rounded text-[10px]">{diff.comparisonContext.currentCommitSha?.slice(0, 7) ?? "N/A"}</code>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/analyses/${diff.baseAnalysisId}`)}
              className="flex items-center gap-1.5 h-8 bg-surface shrink-0 text-xs shadow-none"
            >
              <History className="w-3.5 h-3.5" />
              Go to Baseline Analysis
            </Button>
          </div>

          {/* Summary Stat Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Code Impact summary */}
            <div className="flex flex-col p-4 rounded-xl border border-border/40 bg-surface/50">
              <div className="flex items-center gap-2 mb-3">
                <FileCode className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Code Impacts</h4>
              </div>
              <div className="flex flex-col gap-2 mt-auto">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Added:</span>
                  <span className={`font-semibold px-1.5 py-0.5 rounded text-[11px] ${diff.summary.addedImpacts > 0 ? "bg-success/15 text-success" : "text-muted-foreground"}`}>
                    +{diff.summary.addedImpacts}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Removed:</span>
                  <span className={`font-semibold px-1.5 py-0.5 rounded text-[11px] ${diff.summary.removedImpacts > 0 ? "bg-danger/15 text-danger" : "text-muted-foreground"}`}>
                    -{diff.summary.removedImpacts}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Unchanged:</span>
                  <span className="font-semibold text-foreground">{diff.summary.unchangedImpacts}</span>
                </div>
              </div>
            </div>

            {/* Ambiguity & Unknowns summary */}
            <div className="flex flex-col p-4 rounded-xl border border-border/40 bg-surface/50">
              <div className="flex items-center gap-2 mb-3">
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ambiguity & Unknowns</h4>
              </div>
              <div className="flex flex-col gap-2 mt-auto">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Resolved:</span>
                  <span className={`font-semibold px-1.5 py-0.5 rounded text-[11px] ${diff.summary.resolvedUnknowns > 0 ? "bg-success/15 text-success" : "text-muted-foreground"}`}>
                    {diff.summary.resolvedUnknowns} resolved
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Removed:</span>
                  <span className={`font-semibold px-1.5 py-0.5 rounded text-[11px] ${diff.summary.removedUnknowns > 0 ? "bg-danger/15 text-danger" : "text-muted-foreground"}`}>
                    {diff.summary.removedUnknowns} removed
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">New Unknowns:</span>
                  <span className={`font-semibold px-1.5 py-0.5 rounded text-[11px] ${diff.summary.newUnknowns > 0 ? "bg-warning/15 text-warning" : "text-muted-foreground"}`}>
                    +{diff.summary.newUnknowns}
                  </span>
                </div>
              </div>
            </div>

            {/* QA Scenarios summary */}
            <div className="flex flex-col p-4 rounded-xl border border-border/40 bg-surface/50">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">QA Coverage</h4>
              </div>
              <div className="flex flex-col gap-2 mt-auto">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">New QA Scenarios:</span>
                  <span className={`font-bold text-[14px] px-2 py-0.5 rounded ${diff.summary.addedQaScenarios > 0 ? "bg-info/10 text-info" : "text-muted-foreground"}`}>
                    +{diff.summary.addedQaScenarios}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Details Sections */}
          <div className="flex flex-col gap-8 mt-4">
            {/* Impacted Code Artifact Changes */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold border-b border-border/40 pb-2 flex items-center gap-2">
                <span>Impacted Code Artifacts</span>
                <span className="text-xs font-normal text-muted-foreground">({diff.addedArtifacts.length + diff.removedArtifacts.length} changes)</span>
              </h3>

              <div className="flex flex-col gap-2">
                {diff.addedArtifacts.map((art) => (
                  <div key={art.artifactKey} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-success/20 bg-success/5 text-[13px]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex items-center gap-1 text-success font-semibold shrink-0">
                        <Plus className="w-3.5 h-3.5" /> Added
                      </span>
                      <span className="text-muted-foreground/60">|</span>
                      <span className="font-medium text-foreground truncate">{art.name}</span>
                      <span className="text-[11px] px-1.5 py-0.2 rounded bg-surface border border-border text-muted-foreground select-none shrink-0">{art.artifactType}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate select-all">{art.filePath}</div>
                  </div>
                ))}

                {diff.removedArtifacts.map((art) => (
                  <div key={art.artifactKey} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-danger/25 bg-danger/5 text-[13px]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex items-center gap-1 text-danger font-semibold shrink-0">
                        <Minus className="w-3.5 h-3.5" /> Removed
                      </span>
                      <span className="text-muted-foreground/60">|</span>
                      <span className="font-medium text-foreground truncate">{art.name}</span>
                      <span className="text-[11px] px-1.5 py-0.2 rounded bg-surface border border-border text-muted-foreground select-none shrink-0">{art.artifactType}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate select-all">{art.filePath}</div>
                  </div>
                ))}

                {diff.addedArtifacts.length === 0 && diff.removedArtifacts.length === 0 && (
                  <div className="text-xs text-muted-foreground py-6 text-center bg-surface-muted/20 border border-dashed border-border/50 rounded-lg">
                    No code artifact impact changes found between these analyses.
                  </div>
                )}
              </div>
            </div>

            {/* Ambiguity & Unknowns Changes */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold border-b border-border/40 pb-2 flex items-center gap-2">
                <span>Ambiguity & Unknowns</span>
                <span className="text-xs font-normal text-muted-foreground">({diff.resolvedUnknowns.length + diff.removedUnknowns.length + diff.newUnknowns.length} changes)</span>
              </h3>

              <div className="flex flex-col gap-2">
                {diff.resolvedUnknowns.map((ins, idx) => (
                  <div key={idx} className="flex flex-col gap-1.5 p-3 rounded-lg border border-success/20 bg-success/5 text-[13px]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex items-center gap-1 text-success font-semibold shrink-0 text-xs uppercase tracking-wider">
                        <Check className="w-3.5 h-3.5" /> Resolved
                      </span>
                      <span className="text-muted-foreground/60">|</span>
                      <span className="text-foreground font-medium text-[11px] bg-surface px-1.5 py-0.2 rounded border border-border shrink-0">{ins.category}</span>
                      {ins.insightKey && <span className="text-[10px] text-muted-foreground font-mono">({ins.insightKey})</span>}
                    </div>
                    <div className="text-muted-foreground text-xs leading-relaxed pl-1 mt-0.5">{ins.statement}</div>
                  </div>
                ))}

                {diff.newUnknowns.map((ins, idx) => (
                  <div key={idx} className="flex flex-col gap-1.5 p-3 rounded-lg border border-warning/30 bg-warning/5 text-[13px]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex items-center gap-1 text-warning font-semibold shrink-0 text-xs uppercase tracking-wider">
                        <AlertTriangle className="w-3.5 h-3.5" /> New Unknown
                      </span>
                      <span className="text-muted-foreground/60">|</span>
                      <span className="text-foreground font-medium text-[11px] bg-surface px-1.5 py-0.2 rounded border border-border shrink-0">{ins.category}</span>
                      {ins.insightKey && <span className="text-[10px] text-muted-foreground font-mono">({ins.insightKey})</span>}
                    </div>
                    <div className="text-muted-foreground text-xs leading-relaxed pl-1 mt-0.5">{ins.statement}</div>
                  </div>
                ))}

                {diff.removedUnknowns.map((ins, idx) => (
                  <div key={idx} className="flex flex-col gap-1.5 p-3 rounded-lg border border-border/40 bg-surface/50 text-[13px] opacity-80">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex items-center gap-1 text-muted-foreground font-semibold shrink-0 text-xs uppercase tracking-wider">
                        <Minus className="w-3.5 h-3.5" /> Removed
                      </span>
                      <span className="text-muted-foreground/60">|</span>
                      <span className="text-foreground font-medium text-[11px] bg-surface px-1.5 py-0.2 rounded border border-border shrink-0">{ins.category}</span>
                      {ins.insightKey && <span className="text-[10px] text-muted-foreground font-mono">({ins.insightKey})</span>}
                    </div>
                    <div className="text-muted-foreground text-xs leading-relaxed pl-1 mt-0.5">{ins.statement}</div>
                  </div>
                ))}

                {diff.resolvedUnknowns.length === 0 && diff.newUnknowns.length === 0 && diff.removedUnknowns.length === 0 && (
                  <div className="text-xs text-muted-foreground py-6 text-center bg-surface-muted/20 border border-dashed border-border/50 rounded-lg">
                    No unknown or ambiguity status changes between these analyses.
                  </div>
                )}
              </div>
            </div>

            {/* QA Scenarios Added */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold border-b border-border/40 pb-2 flex items-center gap-2">
                <span>QA Coverage Scenarios</span>
                <span className="text-xs font-normal text-muted-foreground">({diff.addedQaScenarios.length} new)</span>
              </h3>

              <div className="flex flex-col gap-2">
                {diff.addedQaScenarios.map((ins, idx) => (
                  <div key={idx} className="flex flex-col gap-1.5 p-3 rounded-lg border border-info/20 bg-info/5 text-[13px]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex items-center gap-1 text-info font-semibold shrink-0 text-xs uppercase tracking-wider">
                        <Plus className="w-3.5 h-3.5" /> New QA Scenario
                      </span>
                      <span className="text-muted-foreground/60">|</span>
                      {ins.insightKey && <span className="text-[10px] text-muted-foreground font-mono">({ins.insightKey})</span>}
                    </div>
                    <div className="text-foreground text-xs leading-relaxed pl-1 mt-0.5">{ins.statement}</div>
                  </div>
                ))}

                {diff.addedQaScenarios.length === 0 && (
                  <div className="text-xs text-muted-foreground py-6 text-center bg-surface-muted/20 border border-dashed border-border/50 rounded-lg">
                    No new QA scenarios generated in the current analysis compared to baseline.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Review Decisions History */}
      <div className="flex flex-col gap-4 mt-6">
        <h3 className="text-sm font-semibold border-b border-border/40 pb-2 flex items-center gap-2">
          <span>Review History</span>
          <span className="text-xs font-normal text-muted-foreground">({decisions.length} decisions)</span>
        </h3>
        
        {decisionsLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : decisions.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center bg-surface-muted/20 border border-dashed border-border/50 rounded-lg">
            No previous review decisions recorded for this analysis.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {decisions.map((item) => {
              const badgeColors = 
                item.decision === 'ACCEPTED' ? 'bg-success/10 text-success border-success/30' :
                item.decision === 'REJECTED' ? 'bg-danger/10 text-danger border-danger/30' :
                'bg-warning/10 text-warning border-warning/30'

              const DecisionIcon = 
                item.decision === 'ACCEPTED' ? ThumbsUp :
                item.decision === 'REJECTED' ? ThumbsDown :
                HelpCircle

              return (
                <div key={item.id} className="flex flex-col gap-2 p-4 rounded-xl border border-border/40 bg-surface/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border ${badgeColors}`}>
                        <DecisionIcon className="w-3.5 h-3.5" />
                        {item.decision}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        {item.reviewedBy}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {item.note && (
                    <div className="mt-2 text-xs text-muted-foreground bg-surface-muted/30 p-2.5 rounded-lg border border-border/20 italic leading-relaxed">
                      &quot;{item.note}&quot;
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Submit Review Decision Form */}
      {analysis.capabilities.canReview ? (
        <>
          {/* Clarification Workflow Block */}
          <AnalysisClarificationBlock analysisId={analysisId} latestDecision={decisions[0]} />

          {/* Decision form */}
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6 p-5 rounded-xl border border-border bg-surface-muted/30">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Submit Review Decision</h3>
            <p className="text-xs text-muted-foreground mt-1">Submit your assessment of this change request&apos;s code impact.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Assessment
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={!diffComputable || isViewer}
                onClick={() => setDecision('ACCEPTED')}
                className={`h-9 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-all select-none ${
                  decision === 'ACCEPTED'
                    ? 'bg-success/15 border-success text-success shadow-[0_0_8px_rgba(34,197,94,0.15)]'
                    : !diffComputable || isViewer
                    ? 'opacity-40 bg-surface-muted border-border/30 text-muted-foreground/60 cursor-not-allowed'
                    : 'bg-surface border-border/60 hover:bg-surface-muted text-muted-foreground hover:text-foreground'
                }`}
                title={isViewer ? "You have view-only access. Reviewer or Admin role required." : !diffComputable ? "Disabled because difference report is unavailable" : "Accept the analysis"}
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                Accept
              </button>
              <button
                type="button"
                disabled={isViewer}
                onClick={() => setDecision('REJECTED')}
                className={`h-9 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-all select-none ${
                  decision === 'REJECTED'
                    ? 'bg-danger/15 border-danger text-danger shadow-[0_0_8px_rgba(239,68,68,0.15)]'
                    : isViewer
                    ? 'opacity-40 bg-surface-muted border-border/30 text-muted-foreground/60 cursor-not-allowed'
                    : 'bg-surface border-border/60 hover:bg-surface-muted text-muted-foreground hover:text-foreground'
                }`}
                title={isViewer ? "You have view-only access. Reviewer or Admin role required." : "Reject the analysis"}
              >
                <ThumbsDown className="w-3.5 h-3.5" />
                Reject
              </button>
              <button
                type="button"
                disabled={isViewer}
                onClick={() => setDecision('NEEDS_MORE_CLARIFICATION')}
                className={`h-9 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-all select-none ${
                  decision === 'NEEDS_MORE_CLARIFICATION'
                    ? 'bg-warning/15 border-warning text-warning shadow-[0_0_8px_rgba(245,158,11,0.15)]'
                    : isViewer
                    ? 'opacity-40 bg-surface-muted border-border/30 text-muted-foreground/60 cursor-not-allowed'
                    : 'bg-surface border-border/60 hover:bg-surface-muted text-muted-foreground hover:text-foreground'
                }`}
                title={isViewer ? "You have view-only access. Reviewer or Admin role required." : "Request clarification"}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Clarify
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="decision-note" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Notes
              </label>
              <span className={`text-[10px] ${note.length > 2000 ? "text-danger" : "text-muted-foreground"}`}>
                {note.length} / 2000
              </span>
            </div>
            <textarea
              id="decision-note"
              value={note}
              disabled={isViewer}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              placeholder={isViewer ? "Notes are disabled for view-only users." : "Provide context explaining this review decision..."}
              className={`w-full min-h-[80px] p-3 rounded-lg bg-surface border border-border/60 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary resize-y ${isViewer ? 'opacity-50 cursor-not-allowed bg-surface-muted' : ''}`}
              title={isViewer ? "You have view-only access. Reviewer or Admin role required." : undefined}
            />
          </div>

          <div className="flex justify-end mt-2">
            <Button
              type="submit"
              disabled={!decision || createDecision.isPending || (decision === 'ACCEPTED' && !diffComputable) || isViewer}
              className="h-9 px-4 text-xs font-medium flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white"
              title={isViewer ? "You have view-only access. Reviewer or Admin role required." : undefined}
            >
              {createDecision.isPending ? "Submitting..." : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Submit Assessment
                </>
              )}
            </Button>
          </div>
        </form>
        </>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-surface-muted/20 text-xs text-muted-foreground mt-8 select-none">
          <Info className="w-4 h-4 text-muted-foreground shrink-0" />
          <span>This analysis is not in a reviewable state. Overall review decisions are closed.</span>
        </div>
      )}
    </div>
  )
}
