import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  useAnalysisDetail,
  useAnalysisInsights,
  useAnalysisTraceability,
  useReviewInsight,
  useReviewTraceabilityLink,
  useCreateAnalysis
} from "@/hooks/api/use-analyses"
import { useImpactGraph } from "@/hooks/api/use-impact-graph"
import { useQaCoverage } from "@/hooks/api/use-qa-coverage"
import { useReviewQueue } from "@/hooks/api/use-review-queue"
import { useCurrentWorkspace, useOptionalProjectId } from "@/lib/project-context"
import { canFinalizeAnalysis, canReview as canReviewPermission, canRunAnalysis, canViewReviewQueue } from "@/lib/permissions"
import { queryKeys } from "@/lib/api/query-keys"
import { InsightListResponse, TraceabilityLinkListResponse, ImpactGraphNode } from "@ba-helper/contracts"
import { type InsightFilterValue } from "@/components/workspace/shared/insight/insight-filter-bar"

type Insight = InsightListResponse["items"][number]
type TraceabilityLink = TraceabilityLinkListResponse["items"][number]
type TabValue = "insights" | "graph" | "traceability-matrix" | "qa-coverage" | "review-queue" | "diff" | "lineage"

export type WorkspaceSelection =
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

export function useAnalysisWorkspace(analysisId: string) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const activeProjectId = useOptionalProjectId()
  const workspace = useCurrentWorkspace()

  const requestedTab = normalizeTabValue(searchParams?.get("tab") ?? undefined)
  const role = workspace?.membershipRole ?? null
  const canViewQueue = canViewReviewQueue(role)
  const currentTab = requestedTab === "review-queue" && !canViewQueue ? "insights" : requestedTab

  const [selection, setSelection] = useState<WorkspaceSelection>(null)
  const [filter, setFilter] = useState<InsightFilterValue>("ALL")

  // Data Fetching
  const { data: analysis, isLoading: analysisLoading, error: analysisError } = useAnalysisDetail(analysisId)
  const { data: insightsData, isLoading: insightsLoading } = useAnalysisInsights(analysisId)
  const { data: linksData, isLoading: linksLoading } = useAnalysisTraceability(analysisId)
  
  const shouldFetchGraph = currentTab === "graph" || selection?.type === "GRAPH_NODE"
  const shouldFetchQa = currentTab === "qa-coverage"
  const shouldFetchReviewQueue = canViewQueue && currentTab === "review-queue"

  const { data: graphData, isLoading: graphLoading } = useImpactGraph(analysisId, { enabled: shouldFetchGraph })
  const { data: qaCoverageResponse } = useQaCoverage(analysisId, { enabled: shouldFetchQa })
  const { data: reviewQueueResponse, isLoading: reviewQueueLoading } = useReviewQueue(analysisId, { enabled: shouldFetchReviewQueue })

  // Mutations
  const { mutateAsync: reviewInsight } = useReviewInsight(undefined, analysisId)
  const { mutateAsync: reviewLink } = useReviewTraceabilityLink(activeProjectId, analysisId)
  const { mutateAsync: retryAnalysis, isPending: isRetrying } = useCreateAnalysis()

  // Derived State
  const insights = useMemo(() => insightsData?.items ?? [], [insightsData])
  const links = useMemo(() => linksData?.items ?? [], [linksData])
  const qaCoverageData = qaCoverageResponse?.items ?? []

  const selectedInsight = selection?.type === "INSIGHT" ? insights.find(i => i.id === selection.insightId) ?? null : null
  const selectedLink = selection?.type === "TRACEABILITY_LINK" ? links.find(l => l.id === selection.linkId) ?? null : null
  const selectedGraphNode = selection?.type === "GRAPH_NODE" ? selection.node : null

  const needsReviewInsights = useMemo(() => insights.filter(i => i.reviewStatus === "NEEDS_REVIEW"), [insights])

  const filteredInsights = useMemo(() => {
    if (filter === "ALL") return insights
    if (filter === "NEEDS_REVIEW") return insights.filter(i => i.reviewStatus === "NEEDS_REVIEW")
    return insights.filter(i => i.certainty === filter)
  }, [insights, filter])

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

  // Permissions
  const canRerun = Boolean(analysis?.capabilities.canRerun) && canRunAnalysis(role)
  const canReview = Boolean(analysis?.capabilities.canReview) && canReviewPermission(role)
  const canFinalize = Boolean(analysis?.capabilities.canFinalize) && canFinalizeAnalysis(role)

  // Handlers
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

  const { claims, ac, unknowns, questions, qaScenarios } = useMemo(() => ({
    claims:      filteredInsights.filter(i => i.category === "CLAIM"),
    ac:          filteredInsights.filter(i => i.category === "ACCEPTANCE_CRITERIA"),
    unknowns:    filteredInsights.filter(i => i.category === "UNKNOWN"),
    questions:   filteredInsights.filter(i => i.category === "QUESTION"),
    qaScenarios: filteredInsights.filter(i => i.category === "QA_SCENARIO"),
  }), [filteredInsights])

  return {
    // State
    analysisId,
    activeProjectId,
    currentTab,
    selection,
    filter,
    setSelection,
    setFilter,
    
    // Data
    analysis,
    analysisLoading,
    analysisError,
    insights,
    insightsLoading,
    links,
    linksLoading,
    graphData,
    graphLoading,
    qaCoverageData,
    reviewQueueResponse,
    reviewQueueLoading,
    
    // Derived
    selectedInsight,
    selectedLink,
    selectedGraphNode,
    linkedInsights,
    activeEvidence,
    filteredInsights,
    filterCounts,
    totalVisible,
    analysisStats,
    blockingRemaining,
    
    // Categorized Insights
    claims,
    ac,
    unknowns,
    questions,
    qaScenarios,
    
    // Permissions
    canViewQueue,
    canRerun,
    canReview,
    canFinalize,
    
    // Actions
    isRetrying,
    retryAnalysis,
    setTab,
    handleSelectInsight,
    handleSelectLink,
    handleGraphNodeSelect,
    handleInsightReviewChange,
    handleLinkReviewChange
  }
}
