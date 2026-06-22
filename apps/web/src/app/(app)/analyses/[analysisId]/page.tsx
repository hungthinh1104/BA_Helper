"use client"

import { use } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { notFound } from "next/navigation"
import { AlertCircle, Network } from "lucide-react"
import { AnalysisProgress } from "@/components/workspace/analysis/analysis-progress"
import { isAnalysisActive } from "@/lib/status-helpers"
import dynamic from "next/dynamic"
import { QaCoveragePanel } from "@/components/workspace/shared/qa/qa-coverage-panel"
import { ReviewQueuePanel } from "@/components/workspace/review/review-queue-panel"
import { AnalysisTabBar } from "./_components/analysis-tab-bar"
import { AnalysisInsightsTab } from "./_components/analysis-insights-tab"
import { AnalysisDiffTab } from "./_components/analysis-diff-tab"
import { AnalysisTraceabilityMatrixTab } from "./_components/analysis-traceability-matrix-tab"
import { AnalysisLineageTab } from "./_components/analysis-lineage-tab"
import { AnalysisDriftWarning } from "./_components/analysis-drift-warning"
import { useAnalysisWorkspace } from "./_hooks/use-analysis-workspace"
import { AnalysisInspectorMapper } from "./_components/analysis-inspector-mapper"
import { toast } from "sonner"
import { v4 as uuidv4 } from "uuid"

// Dynamic import so React Flow CSS loads correctly in Next.js app router
const ImpactGraphView = dynamic(
  () => import("@/components/graph/impact-graph-view").then(m => ({ default: m.ImpactGraphView })),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading graph…</div> }
)

export default function ImpactAnalysisDetailPage({
  params,
}: {
  params: Promise<{ analysisId: string }>
}) {
  const { analysisId } = use(params)
  const ws = useAnalysisWorkspace(analysisId)

  // ── Loading state ──
  if (ws.analysisLoading || ws.insightsLoading || ws.linksLoading) {
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
  if (ws.analysisError || !ws.analysis) {
    if (ws.analysisError && (ws.analysisError as { status?: number }).status === 404) notFound()
    return (
      <div className="flex flex-col items-center py-32 text-muted-foreground">
        <AlertCircle className="w-8 h-8 text-destructive mb-4" />
        <p className="text-[14px] font-medium text-foreground">Failed to load analysis</p>
        <p className="text-[12px]">{ws.analysisError instanceof Error ? ws.analysisError.message : "Analysis not found"}</p>
      </div>
    )
  }

  // ── In-progress state ──
  if (isAnalysisActive(ws.analysis.status)) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
        <h2 className="text-lg font-semibold text-foreground mb-4">Analyzing Impact</h2>
        <p className="mb-5 max-w-md text-[13px] text-muted-foreground">
          The backend is matching the requirement revision against persisted snapshot evidence. This does not edit code or generate implementation changes.
        </p>
        <AnalysisProgress analysis={ws.analysis} />
      </div>
    )
  }

  // ── Failed state ──
  if (ws.analysis.status === "FAILED") {
    const handleRetryAnalysis = async () => {
      if (!ws.analysis) return
      try {
        await ws.retryAnalysis({
          revisionId: ws.analysis.requirement.revisionId,
          data: { snapshotId: ws.analysis.snapshot.id, sourceTargetId: ws.analysis.sourceTarget.id, allowPartialSnapshot: false, requestKey: uuidv4() },
        })
        toast.success("Analysis rerun started")
      } catch { toast.error("Failed to rerun analysis") }
    }
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
        <AlertCircle className="w-12 h-12 text-danger mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">
          {ws.analysis.error?.code ? `Analysis Failed: ${ws.analysis.error.code}` : "Analysis Failed"}
        </h2>
        <p className="text-[13px] text-muted-foreground mb-6 max-w-md">
          {ws.analysis.error?.message || "The impact analysis could not be completed. Please check the logs or try again."}
        </p>
        <p className="mb-6 max-w-md text-[12px] text-muted-foreground">
          {ws.analysis.error?.code === "AI_PROVIDER_UNAVAILABLE" || ws.analysis.error?.code === "LLM_PROVIDER_OVERLOADED"
            ? "Common fixes: wait a few minutes before retrying, or configure a different AI provider/model in settings."
            : ws.analysis.error?.code === "AI_PROVIDER_RATE_LIMITED"
            ? "Common fixes: check your AI provider billing/quota, or wait before retrying."
            : ws.analysis.error?.code === "AI_PROVIDER_TIMEOUT"
            ? "Common fixes: the model took too long to respond. You can retry the analysis, or switch to a faster model."
            : "Common fixes: confirm the selected snapshot is READY or explicitly accepted as PARTIAL, then rerun the analysis from the same requirement revision."}
        </p>
        {ws.canRerun ? (
          <Button onClick={handleRetryAnalysis} disabled={ws.isRetrying}>
            {ws.isRetrying ? "Retrying..." : "Rerun Analysis"}
          </Button>
        ) : (
          <p className="text-[12px] text-muted-foreground">
            An Analyst or Owner can rerun this analysis.
          </p>
        )}
      </div>
    )
  }

  const isFullHeightTab = ws.currentTab === "graph" || ws.currentTab === "review-queue" || ws.currentTab === "diff" || ws.currentTab === "lineage" || ws.currentTab === "traceability-matrix"

  return (
    <AnalysisInspectorMapper
      analysisId={analysisId}
      currentTab={ws.currentTab}
      selectedInsight={ws.selectedInsight}
      selectedLink={ws.selectedLink}
      selectedGraphNode={ws.selectedGraphNode}
      linkedInsights={ws.linkedInsights}
      activeEvidence={ws.activeEvidence}
      qaCoverageData={ws.qaCoverageData}
      canReview={ws.canReview}
      isFullHeightTab={isFullHeightTab}
      onSelectInsight={ws.handleSelectInsight}
      onCloseInspector={() => ws.setSelection(null)}
      onInsightReviewChange={ws.handleInsightReviewChange}
      onLinkReviewChange={ws.handleLinkReviewChange}
    >
      {/* app-page-scroll no longer has default padding. Add explicit padding for normal tabs. */}
      <div className={`app-page-scroll flex h-full min-h-0 flex-col gap-3 ${isFullHeightTab ? "overflow-hidden" : "p-4 md:p-6"}`}>
        <div className={isFullHeightTab ? "shrink-0 px-4 pt-4 flex flex-col gap-3" : "contents"}>
          <AnalysisDriftWarning projectId={ws.activeProjectId} analysisId={analysisId} />

          <AnalysisTabBar
            analysis={ws.analysis}
            canFinalize={ws.canFinalize}
            stats={ws.analysisStats}
            activeTab={ws.currentTab}
            onTabChange={ws.setTab}
            blockingRemaining={ws.blockingRemaining}
          />
        </div>

        <div className={isFullHeightTab ? "flex min-h-0 flex-1 flex-col" : "contents"}>
          {/* Graph tab */}
          {ws.currentTab === "graph" && (
            <div className="flex h-full min-h-0 w-full flex-col bg-surface border-t border-border/40">
              {ws.graphLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading graph…</div>
              ) : ws.graphData ? (
                <ImpactGraphView
                  nodes={ws.graphData.nodes}
                  edges={ws.graphData.edges}
                  isTruncated={ws.graphData.nodes.some(n => n.isTruncated)}
                  onNodeSelect={ws.handleGraphNodeSelect}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Network className="w-8 h-8 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No graph data available</p>
                </div>
              )}
            </div>
          )}

          {ws.currentTab === "qa-coverage" && (
            <div className="mt-4 pb-12">
              <QaCoveragePanel
                coverageItems={ws.qaCoverageData}
                onSelectArtifact={(artifactId) => {
                  const node = ws.graphData?.nodes.find(n => n.id === `artifact-${artifactId}`)
                  if (node) ws.handleGraphNodeSelect(node)
                }}
              />
            </div>
          )}

          {/* Traceability Matrix tab */}
          {ws.currentTab === "traceability-matrix" && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface border-t border-border/40">
              <AnalysisTraceabilityMatrixTab 
                analysis={ws.analysis}
                insights={ws.insights}
                links={ws.links}
                graphNodes={ws.graphData?.nodes}
                onSelectLink={ws.handleSelectLink}
                onSelectInsight={ws.handleSelectInsight}
              />
            </div>
          )}

          {/* Review Queue tab — true full bleed layout */}
          {ws.currentTab === "review-queue" && (
            <div className="flex min-h-0 flex-1 w-full bg-surface border-t border-border/40">
              {ws.reviewQueueLoading ? (
                <div className="w-full h-full p-4 flex gap-4">
                  <Skeleton className="w-[360px] h-full rounded-xl" />
                  <Skeleton className="flex-1 h-full rounded-xl" />
                </div>
              ) : ws.reviewQueueResponse ? (
                <ReviewQueuePanel
                  queueData={ws.reviewQueueResponse}
                  canReview={ws.canReview}
                  canViewReviewQueue={ws.canViewQueue}
                  onSelect={(type, id, artifactId) => {
                    if (type === "INSIGHT") ws.handleSelectInsight(ws.insights.find(i => i.id === id)!)
                    else if (type === "TRACEABILITY_LINK" && artifactId) ws.setSelection({ type: "TRACEABILITY_LINK", linkId: id, artifactId })
                    else if (type === "GRAPH_NODE" && artifactId) {
                      const node = ws.graphData?.nodes.find(n => n.id === `artifact-${artifactId}`)
                      if (node) ws.setSelection({ type: "GRAPH_NODE", nodeId: node.id, node })
                    }
                  }}
                  selectedQueueItemId={ws.selectedInsight?.id ?? ws.selectedLink?.id}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full w-full text-muted-foreground">
                  <span className="text-3xl mb-3">📋</span>
                  <p className="text-sm font-medium">No review queue data available</p>
                </div>
              )}
            </div>
          )}

          {/* Diff tab */}
          {ws.currentTab === "diff" && (
            <AnalysisDiffTab analysisId={analysisId} analysis={ws.analysis} />
          )}

          {/* Lineage tab */}
          {ws.currentTab === "lineage" && (
            <AnalysisLineageTab analysisId={analysisId} />
          )}

          {/* Insights tab */}
          {ws.currentTab === "insights" && (
            <AnalysisInsightsTab
              claims={ws.claims}
              ac={ws.ac}
              unknowns={ws.unknowns}
              questions={ws.questions}
              qaScenarios={ws.qaScenarios}
              links={ws.links}
              selectedInsight={ws.selectedInsight}
              selectedLink={ws.selectedLink}
              filter={ws.filter}
              filterCounts={ws.filterCounts}
              totalVisible={ws.totalVisible}
              filteredInsights={ws.filteredInsights}
              showStartReview={ws.analysis.status === "WAITING_FOR_REVIEW"}
              blockingRemaining={ws.blockingRemaining}
              onSelectInsight={ws.handleSelectInsight}
              onSelectLink={ws.handleSelectLink}
              onFilterChange={ws.setFilter}
              onGoToReviewQueue={() => ws.setTab("review-queue")}
            />
          )}

        </div>
      </div>
    </AnalysisInspectorMapper>
  )
}
