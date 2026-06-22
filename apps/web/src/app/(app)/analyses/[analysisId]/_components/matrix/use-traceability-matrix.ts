import { useState, useMemo, useEffect } from "react"
import { classifyInsight } from "../analysis-traceability-matrix.util"
import type { ImpactGraphNode, InsightListResponse, TraceabilityLinkListResponse } from "@ba-helper/contracts"

type Insight = InsightListResponse["items"][number]
type TraceabilityLink = TraceabilityLinkListResponse["items"][number]

export type TraceType =
  | "EVIDENCE_BACKED_IMPACT"
  | "INFERRED_IMPACT"
  | "DIAGNOSTIC_DERIVED_RISK"
  | "QA_COVERAGE"
  | "OPEN_QUESTION"

export type RowKind = "traceability_link" | "insight" | "qa_scenario" | "diagnostic_risk" | "open_question"

export interface MatrixRow {
  id: string
  sourceKind: RowKind
  artifactName: string
  artifactKind: string
  filePath: string
  traceType: TraceType
  certainty: string
  evidenceLabel: string
  reviewStatus: string
  originalLink?: TraceabilityLink
  originalInsight?: Insight
  originalName: string
}

export const TRACE_TYPE_LABEL: Record<TraceType, string> = {
  EVIDENCE_BACKED_IMPACT: "Evidence-backed Impact",
  INFERRED_IMPACT: "Inferred Impact",
  DIAGNOSTIC_DERIVED_RISK: "Unknown / Risk",
  QA_COVERAGE: "QA Scenario",
  OPEN_QUESTION: "Open Question",
}

export const TRACE_GROUPS: Array<{ type: TraceType; label: string }> = [
  { type: "EVIDENCE_BACKED_IMPACT", label: "Evidence-backed impacts" },
  { type: "INFERRED_IMPACT", label: "Inferred impacts" },
  { type: "DIAGNOSTIC_DERIVED_RISK", label: "Unknowns / risks" },
  { type: "QA_COVERAGE", label: "QA scenarios" },
  { type: "OPEN_QUESTION", label: "Open questions" },
]

export const ROWS_PER_PAGE = 50

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])

  return debounced
}

export function useTraceabilityMatrix(
  insights: Insight[],
  links: TraceabilityLink[],
  graphNodes: ImpactGraphNode[] = []
) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [traceTypeFilter, setTraceTypeFilter] = useState<string>("ALL")
  const [certaintyFilter, setCertaintyFilter] = useState<string>("ALL")
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>("ALL")
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebouncedValue(searchTerm, 150)

  const graphNodeByArtifactId = useMemo(() => {
    const map = new Map<string, ImpactGraphNode>()
    for (const node of graphNodes) {
      if (node.id.startsWith("artifact-")) {
        map.set(node.id.replace("artifact-", ""), node)
      }
    }
    return map
  }, [graphNodes])

  const rows = useMemo(() => {
    const generatedRows: MatrixRow[] = []

    for (const link of links) {
      const node = graphNodeByArtifactId.get(link.artifactId)
      const isEvidenced = link.linkBasis === "EVIDENCED"
      const filePath = link.evidence[0]?.filePath ?? node?.filePath ?? "—"

      generatedRows.push({
        id: link.id,
        sourceKind: "traceability_link",
        artifactName: node?.label ?? link.evidence[0]?.artifactKey ?? "Unknown Artifact",
        artifactKind: node?.type ?? "UNKNOWN",
        filePath,
        traceType: isEvidenced ? "EVIDENCE_BACKED_IMPACT" : "INFERRED_IMPACT",
        certainty: isEvidenced ? "EVIDENCED" : "INFERRED",
        evidenceLabel: `${link.evidence.length} evidence`,
        reviewStatus: link.reviewStatus,
        originalLink: link,
        originalName: node?.label ?? link.evidence[0]?.artifactKey ?? "Unknown Artifact",
      })
    }

    for (const insight of insights) {
      const classification = classifyInsight(insight)
      if (!classification) continue

      const filePath = insight.evidence[0]?.filePath ?? "—"
      const evidenceLabel =
        insight.evidence.length > 0
          ? `${insight.evidence.length} evidence`
          : "No direct evidence"

      generatedRows.push({
        id: insight.id,
        sourceKind: classification.sourceKind,
        artifactName: insight.statement,
        artifactKind: "INSIGHT",
        filePath,
        traceType: classification.traceType,
        certainty: insight.certainty,
        evidenceLabel,
        reviewStatus: insight.reviewStatus,
        originalInsight: insight,
        originalName: insight.statement,
      })
    }

    return generatedRows.sort((a, b) => {
      const groupDiff =
        TRACE_GROUPS.findIndex(group => group.type === a.traceType) -
        TRACE_GROUPS.findIndex(group => group.type === b.traceType)
      if (groupDiff !== 0) return groupDiff
      return a.artifactName.localeCompare(b.artifactName)
    })
  }, [graphNodeByArtifactId, insights, links])

  const filteredRows = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase()

    return rows.filter(row => {
      if (traceTypeFilter !== "ALL" && row.traceType !== traceTypeFilter) return false
      if (certaintyFilter !== "ALL" && row.certainty !== certaintyFilter) return false
      if (reviewStatusFilter !== "ALL" && row.reviewStatus !== reviewStatusFilter) return false

      if (!needle) return true

      const meta = (row.originalInsight as unknown as Record<string, unknown>)?.metadata as Record<string, unknown> | undefined
      const diagnosticCode =
        ((meta?.diagnostic as Record<string, unknown>)?.code as string | undefined) ||
        (meta?.diagnosticCode as string | undefined) ||
        ""

      return [
        row.originalName,
        row.filePath,
        TRACE_TYPE_LABEL[row.traceType],
        diagnosticCode,
      ].some(value => value.toLowerCase().includes(needle))
    })
  }, [rows, debouncedSearch, traceTypeFilter, certaintyFilter, reviewStatusFilter])

  const summaryCounts = useMemo(() => {
    return {
      evidenceBacked: rows.filter(row => row.traceType === "EVIDENCE_BACKED_IMPACT").length,
      unknownRisk: rows.filter(row => row.traceType === "DIAGNOSTIC_DERIVED_RISK").length,
      qa: rows.filter(row => row.traceType === "QA_COVERAGE").length,
      reviewRemaining: rows.filter(row => row.reviewStatus === "NEEDS_REVIEW").length,
    }
  }, [rows])

  const hasActiveFilters =
    traceTypeFilter !== "ALL" ||
    certaintyFilter !== "ALL" ||
    reviewStatusFilter !== "ALL" ||
    searchTerm.trim().length > 0

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = filteredRows.length === 0 ? 0 : (currentPage - 1) * ROWS_PER_PAGE
  const pageEnd = Math.min(pageStart + ROWS_PER_PAGE, filteredRows.length)
  const visibleStart = filteredRows.length === 0 ? 0 : pageStart + 1
  const pagedRows = filteredRows.slice(pageStart, pageEnd)

  const clearFilters = () => {
    setSearchTerm("")
    setTraceTypeFilter("ALL")
    setCertaintyFilter("ALL")
    setReviewStatusFilter("ALL")
    setPage(1)
  }

  const handleSearchChange = (val: string) => {
    setSearchTerm(val)
    setPage(1)
  }

  const handleTraceTypeChange = (val: string) => {
    setTraceTypeFilter(val)
    setPage(1)
  }

  const handleCertaintyChange = (val: string) => {
    setCertaintyFilter(val)
    setPage(1)
  }

  const handleReviewStatusChange = (val: string) => {
    setReviewStatusFilter(val)
    setPage(1)
  }

  return {
    rows,
    filteredRows,
    pagedRows,
    summaryCounts,
    
    searchTerm,
    traceTypeFilter,
    certaintyFilter,
    reviewStatusFilter,
    hasActiveFilters,
    
    page,
    currentPage,
    totalPages,
    visibleStart,
    pageEnd,
    
    selectedRowId,
    setSelectedRowId,
    setPage,
    clearFilters,
    handleSearchChange,
    handleTraceTypeChange,
    handleCertaintyChange,
    handleReviewStatusChange,
  }
}
