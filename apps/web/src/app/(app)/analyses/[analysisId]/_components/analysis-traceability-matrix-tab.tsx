"use client"

import { useEffect, useMemo, useState, Fragment } from "react"
import { Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ArtifactKindBadge,
  CertaintyBadge,
  ReviewStatusBadge,
} from "@/components/workspace/shared/status-badges"
import { classifyInsight } from "./analysis-traceability-matrix.util"
import type {
  ImpactAnalysisResponse,
  ImpactGraphNode,
  InsightListResponse,
  TraceabilityLinkListResponse,
} from "@ba-helper/contracts"

type Insight = InsightListResponse["items"][number]
type TraceabilityLink = TraceabilityLinkListResponse["items"][number]

export interface AnalysisTraceabilityMatrixTabProps {
  analysis: ImpactAnalysisResponse
  insights: Insight[]
  links: TraceabilityLink[]
  graphNodes?: ImpactGraphNode[]
  onSelectLink: (link: TraceabilityLink) => void
  onSelectInsight: (insight: Insight) => void
}

type TraceType =
  | "EVIDENCE_BACKED_IMPACT"
  | "INFERRED_IMPACT"
  | "DIAGNOSTIC_DERIVED_RISK"
  | "QA_COVERAGE"
  | "OPEN_QUESTION"

type RowKind = "traceability_link" | "insight" | "qa_scenario" | "diagnostic_risk" | "open_question"

interface MatrixRow {
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

const TRACE_TYPE_LABEL: Record<TraceType, string> = {
  EVIDENCE_BACKED_IMPACT: "Evidence-backed Impact",
  INFERRED_IMPACT: "Inferred Impact",
  DIAGNOSTIC_DERIVED_RISK: "Unknown / Risk",
  QA_COVERAGE: "QA Scenario",
  OPEN_QUESTION: "Open Question",
}

const TRACE_GROUPS: Array<{ type: TraceType; label: string }> = [
  { type: "EVIDENCE_BACKED_IMPACT", label: "Evidence-backed impacts" },
  { type: "INFERRED_IMPACT", label: "Inferred impacts" },
  { type: "DIAGNOSTIC_DERIVED_RISK", label: "Unknowns / risks" },
  { type: "QA_COVERAGE", label: "QA scenarios" },
  { type: "OPEN_QUESTION", label: "Open questions" },
]

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])

  return debounced
}

export function AnalysisTraceabilityMatrixTab({
  analysis,
  insights,
  links,
  graphNodes = [],
  onSelectLink,
  onSelectInsight,
}: AnalysisTraceabilityMatrixTabProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [traceTypeFilter, setTraceTypeFilter] = useState<string>("ALL")
  const [certaintyFilter, setCertaintyFilter] = useState<string>("ALL")
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>("ALL")
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

  const handleRowClick = (row: MatrixRow) => {
    setSelectedRowId(row.id)
    if (row.originalLink) {
      onSelectLink(row.originalLink)
    } else if (row.originalInsight) {
      onSelectInsight(row.originalInsight)
    }
  }

  const clearFilters = () => {
    setSearchTerm("")
    setTraceTypeFilter("ALL")
    setCertaintyFilter("ALL")
    setReviewStatusFilter("ALL")
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-12 text-center text-muted-foreground">
        <p className="text-sm font-medium text-foreground">No traceability data available</p>
        <p className="mt-2 text-sm opacity-70">
          This matrix will populate once the impact analysis is complete.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="border-b border-border/40 p-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-border/60 bg-surface-muted/40 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Evidence-backed</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{summaryCounts.evidenceBacked}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-surface-muted/40 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Unknown / Risk</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{summaryCounts.unknownRisk}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-surface-muted/40 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">QA Scenarios</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{summaryCounts.qa}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-surface-muted/40 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Needs Review</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{summaryCounts.reviewRemaining}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search traceability..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="h-9 pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={traceTypeFilter === "ALL" ? "default" : "outline"} className="h-9 shadow-none" onClick={() => setTraceTypeFilter("ALL")}>
              All types
            </Button>
            {TRACE_GROUPS.map(group => (
              <Button
                key={group.type}
                size="sm"
                variant={traceTypeFilter === group.type ? "default" : "outline"}
                className="h-9 shadow-none"
                onClick={() => setTraceTypeFilter(group.type)}
              >
                {group.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {["ALL", "EVIDENCED", "INFERRED", "UNKNOWN", "CONFLICTING"].map(value => (
            <Button
              key={value}
              size="sm"
              variant={certaintyFilter === value ? "default" : "outline"}
              className="h-8 shadow-none"
              onClick={() => setCertaintyFilter(value)}
            >
              {value === "ALL" ? "All certainty" : value.replace(/_/g, " ")}
            </Button>
          ))}
          {["ALL", "NEEDS_REVIEW", "CONFIRMED", "REJECTED"].map(value => (
            <Button
              key={value}
              size="sm"
              variant={reviewStatusFilter === value ? "default" : "outline"}
              className="h-8 shadow-none"
              onClick={() => setReviewStatusFilter(value)}
            >
              {value === "ALL" ? "All reviews" : value.replace(/_/g, " ")}
            </Button>
          ))}
          {hasActiveFilters ? (
            <Button size="sm" variant="ghost" className="h-8 shadow-none" onClick={clearFilters}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="min-w-[980px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-surface">
              <TableRow>
                <TableHead className="w-[280px]">Artifact / Item</TableHead>
                <TableHead className="w-[120px]">Kind</TableHead>
                <TableHead className="w-[220px]">Path</TableHead>
                <TableHead className="w-[170px]">Trace Type</TableHead>
                <TableHead className="w-[120px]">Certainty</TableHead>
                <TableHead className="w-[120px]">Evidence</TableHead>
                <TableHead className="w-[130px]">Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length > 0 && (
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={7} className="py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Requirement: {analysis.requirement.revisionTitle || analysis.requirement.id || "Current requirement change"}
                    <span className="ml-2 font-normal lowercase">({filteredRows.length} rows)</span>
                  </TableCell>
                </TableRow>
              )}

              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No matching rows found.
                  </TableCell>
                </TableRow>
              ) : (
                TRACE_GROUPS.map(group => {
                  const rowsInGroup = filteredRows.filter(row => row.traceType === group.type)
                  if (rowsInGroup.length === 0) return null

                  return (
                    <Fragment key={group.type}>
                      <TableRow className="bg-surface-muted/30 hover:bg-surface-muted/30">
                        <TableCell colSpan={7} className="border-t py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground/70">
                          {group.label} <span className="ml-1 opacity-70">({rowsInGroup.length})</span>
                        </TableCell>
                      </TableRow>
                      {rowsInGroup.map(row => (
                        <TableRow
                          key={row.id}
                          className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                            row.id === selectedRowId ? "bg-primary/10" : ""
                          }`}
                          onClick={() => handleRowClick(row)}
                        >
                          <TableCell className="max-w-[280px]">
                            <div className="space-y-1">
                              <p className="line-clamp-2 text-sm font-medium text-foreground">{row.artifactName}</p>
                              {row.sourceKind !== "traceability_link" ? (
                                <p className="text-xs text-muted-foreground">{row.originalInsight?.category.replace(/_/g, " ")}</p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            {row.artifactKind !== "INSIGHT" ? <ArtifactKindBadge kind={row.artifactKind} /> : <span className="text-xs text-muted-foreground">Insight</span>}
                          </TableCell>
                          <TableCell title={row.filePath}>
                            <span className="line-clamp-2 text-xs font-mono text-muted-foreground">{row.filePath}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-foreground">{TRACE_TYPE_LABEL[row.traceType]}</span>
                          </TableCell>
                          <TableCell>
                            <CertaintyBadge certainty={row.certainty} />
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="text-sm text-primary hover:underline"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleRowClick(row)
                              }}
                            >
                              {row.evidenceLabel}
                            </button>
                          </TableCell>
                          <TableCell>
                            <ReviewStatusBadge status={row.reviewStatus} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
