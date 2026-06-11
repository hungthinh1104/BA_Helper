"use client"

import { useState, useMemo, useEffect, use } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { ImpactAnalysisWorkspace } from "@/components/workspace/impact-analysis-workspace"
import { AnalysisHeader } from "@/components/workspace/analysis-header"
import { InsightList } from "@/components/workspace/insight-list"
import { AffectedArtifactCard } from "@/components/workspace/affected-artifact-card"
import { CodeEvidenceBlock } from "@/components/workspace/code-evidence-block"
import { ReviewActionPanel } from "@/components/workspace/review-action-panel"
import { InsightFilterBar, InsightFilterValue } from "@/components/workspace/insight-filter-bar"
import { Button } from "@/components/ui/button"
import { useAnalysisDetail, useAnalysisInsights, useAnalysisTraceability, useReviewInsight, useCreateAnalysis } from "@/hooks/api/use-analyses"
import { InsightListResponse, TraceabilityLinkListResponse } from "@ba-helper/contracts"
import { Skeleton } from "@/components/ui/skeleton"
import { notFound } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { AnalysisProgress } from "@/components/workspace/analysis-progress"
import { isAnalysisActive } from "@/lib/status-helpers"
import { v4 as uuidv4 } from "uuid"

type Insight = InsightListResponse["items"][number]
type TraceabilityLink = TraceabilityLinkListResponse["items"][number]

export default function ImpactAnalysisDetailPage({ params }: { params: Promise<{ analysisId: string }> }) {
  const { analysisId } = use(params)
  const { data: analysis, isLoading: analysisLoading, error: analysisError } = useAnalysisDetail("default-project", analysisId)
  const { data: insightsData, isLoading: insightsLoading } = useAnalysisInsights("default-project", analysisId)
  const { data: linksData, isLoading: linksLoading } = useAnalysisTraceability("default-project", analysisId)
  const { mutateAsync: reviewInsight } = useReviewInsight("default-project", analysisId)
  const { mutateAsync: retryAnalysis, isPending: isRetrying } = useCreateAnalysis("default-project")

  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null)
  const [selectedLink, setSelectedLink] = useState<TraceabilityLink | null>(null)
  
  // Local state for review simulation
  const [insights, setInsights] = useState<Insight[]>([])
  const [links, setLinks] = useState<TraceabilityLink[]>([])
  const [filter, setFilter] = useState<InsightFilterValue>("ALL")

  useEffect(() => {
    if (insightsData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInsights(insightsData.items)
    }
  }, [insightsData])

  useEffect(() => {
    if (linksData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLinks(linksData.items)
    }
  }, [linksData])

  const needsReviewInsights = useMemo(
    () => insights.filter(i => i.reviewStatus === "NEEDS_REVIEW"),
    [insights]
  )

  const handleSelectInsight = (insight: Insight) => {
    setSelectedInsight(insight)
    setSelectedLink(null)
  }

  const handleSelectLink = (link: TraceabilityLink) => {
    setSelectedLink(link)
    setSelectedInsight(null)
  }

  const autoAdvanceReview = (currentId: string) => {
    const nextItem = needsReviewInsights.find(i => i.id !== currentId)
    if (nextItem) setSelectedInsight(nextItem)
  }

  const handleInsightReviewChange = async (status: Insight["reviewStatus"]) => {
    if (!selectedInsight) return
    if (status !== "NEEDS_REVIEW") {
      try {
        await reviewInsight({ insightId: selectedInsight.id, data: { reviewStatus: status } })
      } catch (err: unknown) {
        toast.error("Failed to update review status", {
          description: err instanceof Error ? err.message : "Please try again.",
        })
        return
      }
    }
    const updated = { ...selectedInsight, reviewStatus: status }
    setInsights(prev => prev.map(i => i.id === selectedInsight.id ? updated : i))
    if (status !== "NEEDS_REVIEW") {
      autoAdvanceReview(selectedInsight.id)
    } else {
      setSelectedInsight(updated)
    }
  }

  const handleLinkReviewChange = (status: TraceabilityLink["reviewStatus"]) => {
    if (!selectedLink) return
    const updated = { ...selectedLink, reviewStatus: status }
    setLinks(prev => prev.map(l => l.id === selectedLink.id ? updated : l))
    setSelectedLink(updated)
  }

  const handleStartReview = () => {
    if (needsReviewInsights.length === 0) return
    setSelectedInsight(needsReviewInsights[0])
    setSelectedLink(null)
  }

  const activeItem = selectedInsight || selectedLink
  const activeEvidence = activeItem?.evidence || []

  const filteredInsights = useMemo(() => {
    if (filter === "ALL") return insights
    if (filter === "NEEDS_REVIEW") return insights.filter(i => i.reviewStatus === "NEEDS_REVIEW")
    return insights.filter(i => i.certainty === filter)
  }, [insights, filter])

  // Single-pass group — only recomputes when filteredInsights changes
  const { claims, ac, unknowns, questions, qaScenarios } = useMemo(() => ({
    claims:      filteredInsights.filter(i => i.category === "CLAIM"),
    ac:          filteredInsights.filter(i => i.category === "ACCEPTANCE_CRITERIA"),
    unknowns:    filteredInsights.filter(i => i.category === "UNKNOWN"),
    questions:   filteredInsights.filter(i => i.category === "QUESTION"),
    qaScenarios: filteredInsights.filter(i => i.category === "QA_SCENARIO"),
  }), [filteredInsights])

  // Single-pass reduce instead of 5 separate .filter().length calls
  const filterCounts = useMemo(() => insights.reduce(
    (acc, insight) => {
      acc.ALL += 1
      if (insight.certainty === "EVIDENCED")       acc.EVIDENCED += 1
      if (insight.certainty === "INFERRED")        acc.INFERRED += 1
      if (insight.certainty === "UNKNOWN")         acc.UNKNOWN += 1
      if (insight.certainty === "CONFLICTING")     acc.CONFLICTING += 1
      if (insight.reviewStatus === "NEEDS_REVIEW") acc.NEEDS_REVIEW += 1
      return acc
    },
    { ALL: 0, EVIDENCED: 0, INFERRED: 0, UNKNOWN: 0, CONFLICTING: 0, NEEDS_REVIEW: 0 }
  ), [insights])

  const totalVisible = filteredInsights.length + (filter === "ALL" ? links.length : 0)
  const allReviewed = needsReviewInsights.length === 0 && insights.length > 0

  // ── Inspector content: only evidence blocks ──
  const inspectorContent = activeItem ? (
    <div>
      {activeEvidence.length === 0 ? (
        <div className="flex flex-col items-center text-center py-12 text-muted-foreground">
          <span className="w-10 h-10 rounded-lg bg-surface border border-border/50 flex items-center justify-center mb-3 text-lg">📎</span>
          <p className="text-[13px] font-medium text-foreground mb-1">No code evidence</p>
          <p className="text-[12px]">This insight has no linked evidence yet.</p>
        </div>
      ) : (
        activeEvidence.map((ev, i) => (
          <CodeEvidenceBlock key={ev.id} evidence={ev} index={i} total={activeEvidence.length} />
        ))
      )}
    </div>
  ) : null

  // ── Inspector footer: review actions (always docked, never scrolls) ──
  const inspectorFooter = selectedInsight ? (
    <ReviewActionPanel
      status={selectedInsight.reviewStatus}
      onStatusChange={handleInsightReviewChange}
    />
  ) : selectedLink ? (
    <ReviewActionPanel
      status={selectedLink.reviewStatus}
      onStatusChange={handleLinkReviewChange}
    />
  ) : undefined

  if (analysisLoading || insightsLoading || linksLoading) {
    return (
      <AppShell>
        <div className="max-w-[1400px] mx-auto w-full h-full flex flex-col pt-4 px-4 overflow-hidden">
          <Skeleton className="h-10 w-[300px] mb-4" />
          <Skeleton className="h-6 w-[200px] mb-8" />
          <div className="flex-1 grid grid-cols-12 gap-6 min-h-0 pb-6">
            <div className="col-span-12 xl:col-span-4 flex flex-col gap-6 h-full min-h-0">
              <Skeleton className="h-[400px] w-full" />
            </div>
            <div className="col-span-12 xl:col-span-8 flex flex-col h-full min-h-0 bg-surface border border-border/40 rounded-xl">
              <Skeleton className="h-full w-full" />
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  if (analysisError || !analysis) {
    if (analysisError && (analysisError as { status?: number }).status === 404) {
      notFound()
    }
    return (
      <AppShell>
        <div className="flex flex-col items-center py-32 text-muted-foreground">
          <AlertCircle className="w-8 h-8 text-destructive mb-4" />
          <p className="text-[14px] font-medium text-foreground">Failed to load analysis</p>
          <p className="text-[12px]">{analysisError instanceof Error ? analysisError.message : "Analysis not found"}</p>
        </div>
      </AppShell>
    )
  }

  const handleRetryAnalysis = async () => {
    if (!analysis) return
    try {
      await retryAnalysis({
        snapshotId: analysis.snapshot.id,
        sourceTargetId: analysis.sourceTarget.id,
        allowPartialSnapshot: false,
        requestKey: uuidv4(),
      })
      toast.success("Analysis rerun started")
    } catch (error) {
      toast.error("Failed to rerun analysis")
      console.error(error)
    }
  }

  if (isAnalysisActive(analysis.status)) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
          <h2 className="text-lg font-semibold text-foreground mb-4">Analyzing Impact</h2>
          <AnalysisProgress analysis={analysis} />
        </div>
      </AppShell>
    )
  }

  if (analysis.status === "FAILED") {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
          <AlertCircle className="w-12 h-12 text-danger mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Analysis Failed</h2>
          <p className="text-[13px] text-muted-foreground mb-6 max-w-md">
            The impact analysis could not be completed. Please check the logs or try again.
          </p>
          <Button onClick={handleRetryAnalysis} disabled={isRetrying}>
            {isRetrying ? "Retrying..." : "Rerun Analysis"}
          </Button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <ImpactAnalysisWorkspace
        inspectorTitle={
          selectedInsight ? selectedInsight.statement :
          selectedLink ? (selectedLink.evidence[0]?.filePath ?? "Artifact") :
          "Evidence Inspector"
        }
        inspectorSubtitle={
          selectedInsight ? selectedInsight.statement :
          selectedLink ? selectedLink.evidence[0]?.filePath ?? "Artifact" :
          undefined
        }
        inspectorCategory={selectedInsight?.category}
        inspectorCertaintyBadge={
          selectedInsight ? (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${
              selectedInsight.certainty === "EVIDENCED" ? "bg-success/10 text-success border-success/30" :
              selectedInsight.certainty === "INFERRED" ? "bg-info/10 text-info border-info/30" :
              selectedInsight.certainty === "CONFLICTING" ? "bg-danger/10 text-danger border-danger/30" :
              "bg-unknown/10 text-muted-foreground border-border/60"
            }`}>{selectedInsight.certainty}</span>
          ) : undefined
        }
        inspectorContent={inspectorContent}
        inspectorFooter={inspectorFooter}
      >
        <div className="analysis-sticky-header">
          <AnalysisHeader 
            analysis={analysis} 
            stats={{
              confirmed: insights.filter(i => i.reviewStatus === "CONFIRMED").length,
              rejected: insights.filter(i => i.reviewStatus === "REJECTED").length,
              unknowns: insights.filter(i => i.certainty === "UNKNOWN").length,
              conflicts: insights.filter(i => i.certainty === "CONFLICTING").length,
              total: insights.length,
              needsReview: needsReviewInsights.length,
            }}
          />
          <div className="flex items-center justify-between gap-4">
            <InsightFilterBar currentFilter={filter} onFilterChange={setFilter} counts={filterCounts} totalVisible={totalVisible} />
            {!allReviewed && (
              <Button onClick={handleStartReview} disabled={needsReviewInsights.length === 0} size="sm" className="h-8 shadow-none shrink-0">
                Start Review ({needsReviewInsights.length})
              </Button>
            )}
          </div>
        </div>
        
        {allReviewed && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-success/10 border border-success/25 rounded-lg text-sm text-success font-medium">
            <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center shrink-0">
              <span className="text-xs">✓</span>
            </div>
            All insights have been reviewed. You can now finalize or export this analysis.
          </div>
        )}

        <div className="flex flex-col gap-10 max-w-4xl pb-12">
          {claims.length > 0 && (
            <InsightList 
              title="Impact Claims" 
              insights={claims} 
              selectedInsightId={selectedInsight?.id}
              onSelect={handleSelectInsight}
            />
          )}

          {ac.length > 0 && (
            <InsightList 
              title="Acceptance Criteria" 
              insights={ac} 
              selectedInsightId={selectedInsight?.id}
              onSelect={handleSelectInsight}
            />
          )}

          {unknowns.length > 0 && (
            <InsightList 
              title="Unknowns & Missing Implementations" 
              insights={unknowns} 
              selectedInsightId={selectedInsight?.id}
              onSelect={handleSelectInsight}
            />
          )}

          {questions.length > 0 && (
            <InsightList 
              title="BA Clarification Questions" 
              insights={questions} 
              selectedInsightId={selectedInsight?.id}
              onSelect={handleSelectInsight}
            />
          )}

          {qaScenarios.length > 0 && (
            <InsightList 
              title="QA Scenarios" 
              insights={qaScenarios} 
              selectedInsightId={selectedInsight?.id}
              onSelect={handleSelectInsight}
            />
          )}

          {links.length > 0 && filter === "ALL" && (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold mb-1 px-1">Affected Artifacts</h3>
              {links.map(link => (
                <AffectedArtifactCard 
                  key={link.id} 
                  link={link} 
                  isSelected={selectedLink?.id === link.id}
                  onClick={handleSelectLink}
                />
              ))}
            </div>
          )}

          {filteredInsights.length === 0 && filter !== "ALL" && (
            <div className="flex flex-col items-center text-center py-12 px-8 border border-dashed border-border/50 rounded-xl bg-surface-muted/20">
              <div className="w-10 h-10 rounded-lg bg-surface border border-border/50 flex items-center justify-center mb-3">
                <span className="text-lg">🔎</span>
              </div>
              <p className="text-[13px] font-medium text-foreground mb-1">No results</p>
              <p className="text-[12px] text-muted-foreground">No insights match the selected filter. Try switching to <strong>All</strong>.</p>
            </div>
          )}
        </div>
      </ImpactAnalysisWorkspace>
    </AppShell>
  )
}
