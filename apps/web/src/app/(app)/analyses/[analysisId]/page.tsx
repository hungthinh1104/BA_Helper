"use client"

import { useMemo, useState, use } from "react"
import { ImpactAnalysisWorkspace } from "@/components/workspace/analysis/impact-analysis-workspace"
import { ReviewActionPanel } from "@/components/workspace/review/review-action-panel"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { notFound, usePathname, useRouter, useSearchParams } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { AnalysisProgress } from "@/components/workspace/analysis/analysis-progress"
import { isAnalysisActive } from "@/lib/status-helpers"
import { v4 as uuidv4 } from "uuid"
import dynamic from "next/dynamic"
import { QaCoveragePanel } from "@/components/workspace/shared/qa/qa-coverage-panel"
import { ReviewQueuePanel } from "@/components/workspace/review/review-queue-panel"
import { useAnalysisDetail, useAnalysisInsights, useAnalysisTraceability, useReviewInsight, useReviewTraceabilityLink, useCreateAnalysis } from "@/hooks/api/use-analyses"
import { useImpactGraph } from "@/hooks/api/use-impact-graph"
import { useQaCoverage } from "@/hooks/api/use-qa-coverage"
import { useReviewQueue } from "@/hooks/api/use-review-queue"
import { useCurrentWorkspace, useOptionalProjectId } from "@/lib/project-context"
import { useAnalysisStatusWatcher } from "@/hooks/ui/use-status-watcher"
import { InsightListResponse, TraceabilityLinkListResponse, ImpactGraphNode } from "@ba-helper/contracts"
import { type InsightFilterValue } from "@/components/workspace/shared/insight/insight-filter-bar"
import { AnalysisTabBar } from "./_components/analysis-tab-bar"
import { AnalysisInsightsTab } from "./_components/analysis-insights-tab"
import { AnalysisDiffTab } from "./_components/analysis-diff-tab"
import { AnalysisEvidenceInspector } from "./_components/analysis-evidence-inspector"
import { AnalysisTraceabilityMatrixTab } from "./_components/analysis-traceability-matrix-tab"
import { Network } from "lucide-react"

import { AnalysisLineageTab } from "./_components/analysis-lineage-tab"
import { AnalysisDriftWarning } from "./_components/analysis-drift-warning"
import { CertaintyBadge } from "@/components/workspace/shared/status-badges"
import {
  canExportReport,
  canFinalizeAnalysis,
  canReview as canReviewPermission,
  canRunAnalysis,
  canViewReviewQueue,
} from "@/lib/permissions"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/api/query-keys"

// Dynamic import so React Flow CSS loads correctly in Next.js app router
const ImpactGraphView = dynamic(
  () => import("@/components/graph/impact-graph-view").then(m => ({ default: m.ImpactGraphView })),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading graph…</div> }
)

type Insight = InsightListResponse["items"][number]
type TraceabilityLink = TraceabilityLinkListResponse["items"][number]
type TabValue = "insights" | "graph" | "traceability-matrix" | "qa-coverage" | "review-queue" | "diff" | "lineage"

type WorkspaceSelection =
  | { type: "INSIGHT"; insightId: string }
  | { type: "TRACEABILITY_LINK"; linkId: string; artifactId: string }
  | { type: "GRAPH_NODE"; nodeId: string; node: ImpactGraphNode }
  | null

function normalizeTabValue(value: string | string[] | undefined): TabValue {
  const candidate = Array.isArray(value) ? value[0] : value
  switch (candidate) {
    case "graph":
    case "traceability-matrix":
    case "qa-coverage":
    case "review-queue":
    case "diff":
    case "lineage":
      return candidate
    default:
      return "insights"
  }
}

export default function ImpactAnalysisDetailPage({
  params,
}: {
  params: Promise<{ analysisId: string }>
}) {
  const { analysisId } = use(params)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const requestedTab = normalizeTabValue(searchParams?.get("tab") ?? undefined)
  const activeProjectId = useOptionalProjectId()
  const workspace = useCurrentWorkspace()
  const { data: analysis, isLoading: analysisLoading, error: analysisError } = useAnalysisDetail(analysisId)
  const { data: insightsData, isLoading: insightsLoading } = useAnalysisInsights(analysisId)
  const { data: linksData, isLoading: linksLoading } = useAnalysisTraceability(analysisId)
  const { mutateAsync: reviewInsight } = useReviewInsight(undefined, analysisId)
  const { mutateAsync: reviewLink } = useReviewTraceabilityLink(activeProjectId, analysisId)
  const { mutateAsync: retryAnalysis, isPending: isRetrying } = useCreateAnalysis()

  // Watch for analysis job completion/failure to show toast notifications
  useAnalysisStatusWatcher(undefined, analysisId)

  const role = workspace?.membershipRole ?? null
  const canViewQueue = canViewReviewQueue(role)
  const [selection, setSelection] = useState<WorkspaceSelection>(null)
  const [filter, setFilter] = useState<InsightFilterValue>("ALL")
  const currentTab = requestedTab === "review-queue" && !canViewQueue ? "insights" : requestedTab
  const insights = useMemo(() => insightsData?.items ?? [], [insightsData])
  const links = useMemo(() => linksData?.items ?? [], [linksData])

  const shouldFetchGraph = currentTab === "graph" || selection?.type === "GRAPH_NODE"
  const shouldFetchQa = currentTab === "qa-coverage"
  const shouldFetchReviewQueue = canViewQueue && currentTab === "review-queue"

  const { data: graphData, isLoading: graphLoading } = useImpactGraph(analysisId, { enabled: shouldFetchGraph })
  const { data: qaCoverageResponse } = useQaCoverage(analysisId, { enabled: shouldFetchQa })
  const { data: reviewQueueResponse, isLoading: reviewQueueLoading } = useReviewQueue(analysisId, { enabled: shouldFetchReviewQueue })

  const selectedInsight = selection?.type === "INSIGHT" ? insights.find(i => i.id === selection.insightId) ?? null : null
  const selectedLink = selection?.type === "TRACEABILITY_LINK" ? links.find(l => l.id === selection.linkId) ?? null : null
  const selectedGraphNode = selection?.type === "GRAPH_NODE" ? selection.node : null
  const qaCoverageData = qaCoverageResponse?.items ?? []

  const needsReviewInsights = useMemo(() => insights.filter(i => i.reviewStatus === "NEEDS_REVIEW"), [insights])

  const setTab = (tab: TabValue) => {
    const nextTab = tab === "review-queue" && !canViewQueue ? "insights" : tab
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    if (nextTab === "insights") {
      params.delete("tab")
    } else {
      params.set("tab", nextTab)
    }
    const nextQuery = params.toString()
    const basePath = pathname ?? `/analyses/${analysisId}`
    router.replace(nextQuery ? `${basePath}?${nextQuery}` : basePath, { scroll: false })
  }

  const handleSelectInsight = (insight: Insight) => setSelection({ type: "INSIGHT", insightId: insight.id })
  const handleSelectLink = (link: TraceabilityLink) => setSelection({ type: "TRACEABILITY_LINK", linkId: link.id, artifactId: link.artifactId })

  const handleGraphNodeSelect = (node: ImpactGraphNode | null) => {
    if (!node) { setSelection(null); return }
    if (node.type === "INSIGHT" || node.type === "UNKNOWN" || node.type === "QA_SCENARIO") {
      const insight = insights.find(i => i.id === node.id.replace("insight-", ""))
      if (insight) handleSelectInsight(insight)
      else setSelection({ type: "GRAPH_NODE", nodeId: node.id, node })
    } else if (["CONTROLLER", "API_ROUTE", "SERVICE", "SERVICE_METHOD", "ENTITY", "TEST"].includes(node.type)) {
      const artifactId = node.id.replace("artifact-", "")
      const link = links
        .filter(l => l.artifactId === artifactId)
        .sort((a, b) => {
          if (a.reviewStatus === "NEEDS_REVIEW" && b.reviewStatus !== "NEEDS_REVIEW") return -1
          if (b.reviewStatus === "NEEDS_REVIEW" && a.reviewStatus !== "NEEDS_REVIEW") return 1
          return (b.retrieval?.score?.final ?? 0) - (a.retrieval?.score?.final ?? 0)
        })[0]
      if (link) handleSelectLink(link)
      else setSelection({ type: "GRAPH_NODE", nodeId: node.id, node })
    } else {
      setSelection({ type: "GRAPH_NODE", nodeId: node.id, node })
    }
  }

  const handleInsightReviewChange = async (status: Insight["reviewStatus"]) => {
    if (!selectedInsight) return
    if (status !== "NEEDS_REVIEW") {
      try {
        await reviewInsight({ insightId: selectedInsight.id, data: { reviewStatus: status } })
      } catch (err: unknown) {
        toast.error("Failed to update review status", { description: err instanceof Error ? err.message : "Please try again." })
        return
      }
    }
    const updated = { ...selectedInsight, reviewStatus: status }
    queryClient.setQueryData<InsightListResponse | undefined>(
      [...queryKeys.analyses.detail(analysisId), "insights"],
      previous => previous
        ? {
            ...previous,
            items: previous.items.map(i => (i.id === selectedInsight.id ? updated : i)),
          }
        : previous,
    )
    if (status !== "NEEDS_REVIEW") {
      const next = needsReviewInsights.find(i => i.id !== selectedInsight.id)
      if (next) handleSelectInsight(next)
    } else {
      handleSelectInsight(updated)
    }
  }

  const handleLinkReviewChange = async (status: TraceabilityLink["reviewStatus"]) => {
    if (!selectedLink) return
    if (status !== "NEEDS_REVIEW") {
      try {
        await reviewLink({ traceabilityLinkId: selectedLink.id, data: { reviewStatus: status } })
      } catch (err: unknown) {
        toast.error("Failed to update traceability review status", { description: err instanceof Error ? err.message : "Please try again." })
        return
      }
    }
    const updated = { ...selectedLink, reviewStatus: status }
    queryClient.setQueryData<TraceabilityLinkListResponse | undefined>(
      [...queryKeys.analyses.detail(analysisId), "traceability"],
      previous => previous
        ? {
            ...previous,
            items: previous.items.map(l => (l.id === selectedLink.id ? updated : l)),
          }
        : previous,
    )
    handleSelectLink(updated)
  }

  const filteredInsights = useMemo(() => {
    if (filter === "ALL") return insights
    if (filter === "NEEDS_REVIEW") return insights.filter(i => i.reviewStatus === "NEEDS_REVIEW")
    return insights.filter(i => i.certainty === filter)
  }, [insights, filter])

  const { claims, ac, unknowns, questions, qaScenarios } = useMemo(() => ({
    claims:      filteredInsights.filter(i => i.category === "CLAIM"),
    ac:          filteredInsights.filter(i => i.category === "ACCEPTANCE_CRITERIA"),
    unknowns:    filteredInsights.filter(i => i.category === "UNKNOWN"),
    questions:   filteredInsights.filter(i => i.category === "QUESTION"),
    qaScenarios: filteredInsights.filter(i => i.category === "QA_SCENARIO"),
  }), [filteredInsights])

  const filterCounts = useMemo(() => insights.reduce(
    (acc, i) => {
      acc.ALL += 1
      if (i.certainty === "EVIDENCED")       acc.EVIDENCED += 1
      if (i.certainty === "INFERRED")        acc.INFERRED += 1
      if (i.certainty === "UNKNOWN")         acc.UNKNOWN += 1
      if (i.certainty === "CONFLICTING")     acc.CONFLICTING += 1
      if (i.reviewStatus === "NEEDS_REVIEW") acc.NEEDS_REVIEW += 1
      return acc
    },
    { ALL: 0, EVIDENCED: 0, INFERRED: 0, UNKNOWN: 0, CONFLICTING: 0, NEEDS_REVIEW: 0 }
  ), [insights])

  const totalVisible = filteredInsights.length + (filter === "ALL" ? links.length : 0)

  const analysisStats = useMemo(() => ({
    confirmed:   insights.filter(i => i.reviewStatus === "CONFIRMED").length,
    rejected:    insights.filter(i => i.reviewStatus === "REJECTED").length,
    unknowns:    insights.filter(i => i.certainty === "UNKNOWN").length,
    conflicts:   insights.filter(i => i.certainty === "CONFLICTING").length,
    total:       insights.length,
    needsReview: needsReviewInsights.length + links.filter(l => l.reviewStatus === "NEEDS_REVIEW").length,
  }), [insights, needsReviewInsights, links])

  const blockingRemaining = analysisStats.needsReview
  const canRerun = Boolean(analysis?.capabilities.canRerun) && canRunAnalysis(role)
  const canReview = Boolean(analysis?.capabilities.canReview) && canReviewPermission(role)
  const canFinalize = Boolean(analysis?.capabilities.canFinalize) && canFinalizeAnalysis(role)
  const canExport = Boolean(analysis?.capabilities.canExport) && canExportReport(role)

  const linkedInsights = useMemo(() => {
    if (!selectedLink) return []
    return [...insights.filter(i => i.evidence.some(e => e.artifactId === selectedLink.artifactId))]
      .sort((a, b) => {
        const rank = (s: string) => s === "NEEDS_REVIEW" ? 0 : s === "CONFIRMED" ? 2 : s === "REJECTED" ? 3 : 1
        return rank(a.reviewStatus) - rank(b.reviewStatus)
      })
  }, [selectedLink, insights])

  const activeItem = selectedInsight ?? selectedLink
  const activeEvidence = activeItem?.evidence ?? []

  // ── Evidence inspector ──
  const inspectorContent = (
    <AnalysisEvidenceInspector
      analysisId={analysisId}
      selectedInsight={selectedInsight}
      activeEvidence={activeEvidence as Parameters<typeof AnalysisEvidenceInspector>[0]["activeEvidence"]}
      selectedLink={selectedLink}
      linkedInsights={linkedInsights}
      selectedGraphNode={selectedGraphNode}
      qaCoverageData={qaCoverageData}
      onSelectInsight={handleSelectInsight}
      onCloseGraphNode={() => setSelection(null)}
    />
  )

  const inspectorFooter = !canReview ? undefined : selectedInsight ? (
    <ReviewActionPanel
      status={selectedInsight.reviewStatus}
      canReview={canReview}
      onStatusChange={handleInsightReviewChange}
    />
  ) : selectedLink ? (
    <ReviewActionPanel
      status={selectedLink.reviewStatus}
      canReview={canReview}
      onStatusChange={handleLinkReviewChange}
    />
  ) : undefined

  // ── Loading state ──
  if (analysisLoading || insightsLoading || linksLoading) {
    return (
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
    )
  }

  // ── Error state ──
  if (analysisError || !analysis) {
    if (analysisError && (analysisError as { status?: number }).status === 404) notFound()
    return (
      <div className="flex flex-col items-center py-32 text-muted-foreground">
        <AlertCircle className="w-8 h-8 text-destructive mb-4" />
        <p className="text-[14px] font-medium text-foreground">Failed to load analysis</p>
        <p className="text-[12px]">{analysisError instanceof Error ? analysisError.message : "Analysis not found"}</p>
      </div>
    )
  }

  // ── In-progress state ──
  if (isAnalysisActive(analysis.status)) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
        <h2 className="text-lg font-semibold text-foreground mb-4">Analyzing Impact</h2>
        <p className="mb-5 max-w-md text-[13px] text-muted-foreground">
          The backend is matching the requirement revision against persisted snapshot evidence. This does not edit code or generate implementation changes.
        </p>
        <AnalysisProgress analysis={analysis} />
      </div>
    )
  }

  // ── Failed state ──
  if (analysis.status === "FAILED") {
    const handleRetryAnalysis = async () => {
      try {
        await retryAnalysis({
          revisionId: analysis.requirement.revisionId,
          data: { snapshotId: analysis.snapshot.id, sourceTargetId: analysis.sourceTarget.id, allowPartialSnapshot: false, requestKey: uuidv4() },
        })
        toast.success("Analysis rerun started")
      } catch { toast.error("Failed to rerun analysis") }
    }
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
        <AlertCircle className="w-12 h-12 text-danger mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">
          {analysis.error?.code ? `Analysis Failed: ${analysis.error.code}` : "Analysis Failed"}
        </h2>
        <p className="text-[13px] text-muted-foreground mb-6 max-w-md">
          {analysis.error?.message || "The impact analysis could not be completed. Please check the logs or try again."}
        </p>
        <p className="mb-6 max-w-md text-[12px] text-muted-foreground">
          {analysis.error?.code === "AI_PROVIDER_UNAVAILABLE" || analysis.error?.code === "LLM_PROVIDER_OVERLOADED"
            ? "Common fixes: wait a few minutes before retrying, or configure a different AI provider/model in settings."
            : analysis.error?.code === "AI_PROVIDER_RATE_LIMITED"
            ? "Common fixes: check your AI provider billing/quota, or wait before retrying."
            : analysis.error?.code === "AI_PROVIDER_TIMEOUT"
            ? "Common fixes: the model took too long to respond. You can retry the analysis, or switch to a faster model."
            : "Common fixes: confirm the selected snapshot is READY or explicitly accepted as PARTIAL, then rerun the analysis from the same requirement revision."}
        </p>
        {canRerun ? (
          <Button onClick={handleRetryAnalysis} disabled={isRetrying}>
            {isRetrying ? "Retrying..." : "Rerun Analysis"}
          </Button>
        ) : (
          <p className="text-[12px] text-muted-foreground">
            An Analyst or Owner can rerun this analysis.
          </p>
        )}
      </div>
    )
  }

  const isFullHeightTab = currentTab === "graph" || currentTab === "review-queue" || currentTab === "diff" || currentTab === "lineage" || currentTab === "traceability-matrix"

  return (
    <ImpactAnalysisWorkspace
      inspectorTitle={
        isFullHeightTab ? undefined :
        selectedInsight ? selectedInsight.statement :
        selectedLink ? (selectedLink.evidence[0]?.filePath ?? "Artifact") :
        "Evidence Inspector"
      }
      inspectorSubtitle={
        isFullHeightTab ? undefined :
        selectedInsight ? selectedInsight.statement :
        selectedLink ? (selectedLink.evidence[0]?.filePath ?? "Artifact") :
        undefined
      }
      inspectorCategory={isFullHeightTab ? undefined : selectedInsight?.category}
      inspectorCertaintyBadge={
        isFullHeightTab || !selectedInsight ? undefined : (
          <CertaintyBadge certainty={selectedInsight.certainty} />
        )
      }
      inspectorContent={inspectorContent}
      inspectorFooter={currentTab === "review-queue" ? undefined : inspectorFooter}
    >
      {/* app-page-scroll owns 18px padding — matches .analysis-sticky-header bleed math */}
      <div className={`app-page-scroll flex flex-col gap-3 ${isFullHeightTab ? "overflow-hidden" : ""}`}>
          <AnalysisDriftWarning projectId={activeProjectId} analysisId={analysisId} />

          <AnalysisTabBar
            analysis={analysis}
            canExport={canExport}
            canFinalize={canFinalize}
            stats={analysisStats}
            activeTab={currentTab}
            onTabChange={setTab}
            blockingRemaining={blockingRemaining}
          />

          {/* Graph tab */}
          {currentTab === "graph" && (
            <div className="w-full flex-1 min-h-0 relative mt-2">
              {graphLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading graph…</div>
              ) : graphData ? (
                <ImpactGraphView
                  nodes={graphData.nodes}
                  edges={graphData.edges}
                  isTruncated={graphData.nodes.some(n => n.isTruncated)}
                  onNodeSelect={handleGraphNodeSelect}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Network className="w-8 h-8 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No graph data available</p>
                </div>
              )}
            </div>
          )}

          {currentTab === "qa-coverage" && (
            <div className="mt-4 pb-12">
              <QaCoveragePanel
                coverageItems={qaCoverageData}
                onSelectArtifact={(artifactId) => {
                  const node = graphData?.nodes.find(n => n.id === `artifact-${artifactId}`)
                  if (node) handleGraphNodeSelect(node)
                }}
              />
            </div>
          )}

          {/* Traceability Matrix tab */}
          {currentTab === "traceability-matrix" && (
            <div className="mt-4 h-[calc(100vh-280px)] min-h-[500px] border border-border/40 rounded-lg overflow-hidden flex flex-col bg-surface">
              <AnalysisTraceabilityMatrixTab 
                analysis={analysis}
                insights={insights}
                links={links}
                graphNodes={graphData?.nodes}
                onSelectLink={handleSelectLink}
                onSelectInsight={handleSelectInsight}
              />
            </div>
          )}

          {/* Review Queue tab — bleeds to panel edges */}
          {currentTab === "review-queue" && (
            <div className="flex-1 w-full h-full min-h-0 relative -mx-[18px] mt-1" style={{ height: "calc(100vh - var(--topbar-h, 56px) - 120px)" }}>
              {reviewQueueLoading ? (
                <div className="w-full h-full p-4 flex gap-4">
                  <Skeleton className="w-72 h-full rounded-xl" />
                  <Skeleton className="flex-1 h-full rounded-xl" />
                </div>
              ) : reviewQueueResponse ? (
                <ReviewQueuePanel
                  queueData={reviewQueueResponse}
                  canReview={canReview}
                  canViewReviewQueue={canViewQueue}
                  onSelect={(type, id, artifactId) => {
                    if (type === "INSIGHT") handleSelectInsight(insights.find(i => i.id === id)!)
                    else if (type === "TRACEABILITY_LINK" && artifactId) setSelection({ type: "TRACEABILITY_LINK", linkId: id, artifactId })
                    else if (type === "GRAPH_NODE" && artifactId) {
                      const node = graphData?.nodes.find(n => n.id === `artifact-${artifactId}`)
                      if (node) setSelection({ type: "GRAPH_NODE", nodeId: node.id, node })
                    }
                  }}
                  selectedQueueItemId={selectedInsight?.id ?? selectedLink?.id}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <span className="text-3xl mb-3">📋</span>
                  <p className="text-sm font-medium">No review queue data available</p>
                </div>
              )}
            </div>
          )}

          {/* Diff tab */}
          {currentTab === "diff" && (
            <AnalysisDiffTab analysisId={analysisId} analysis={analysis} />
          )}

          {/* Lineage tab */}
          {currentTab === "lineage" && (
            <AnalysisLineageTab analysisId={analysisId} />
          )}

          {/* Insights tab */}
          {currentTab === "insights" && (
            <AnalysisInsightsTab
              claims={claims}
              ac={ac}
              unknowns={unknowns}
              questions={questions}
              qaScenarios={qaScenarios}
              links={links}
              selectedInsight={selectedInsight}
              selectedLink={selectedLink}
              filter={filter}
              filterCounts={filterCounts}
              totalVisible={totalVisible}
              filteredInsights={filteredInsights}
              showStartReview={analysis.status === "WAITING_FOR_REVIEW"}
              blockingRemaining={blockingRemaining}
              onSelectInsight={handleSelectInsight}
              onSelectLink={handleSelectLink}
              onFilterChange={setFilter}
              onGoToReviewQueue={() => setTab("review-queue")}
            />
          )}

      </div>
    </ImpactAnalysisWorkspace>
  )
}
