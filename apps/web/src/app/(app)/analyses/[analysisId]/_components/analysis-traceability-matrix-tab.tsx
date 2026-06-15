"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CertaintyBadge, ArtifactKindBadge } from "@/components/workspace/shared/status-badges"
import type { InsightListResponse, TraceabilityLinkListResponse, ImpactGraphNode, ImpactAnalysisResponse } from "@ba-helper/contracts"

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

type TraceType = "EVIDENCE_BACKED_IMPACT" | "INFERRED_IMPACT" | "DIAGNOSTIC_DERIVED_RISK" | "QA_COVERAGE" | "OPEN_QUESTION"
type RowKind = "traceability_link" | "insight" | "qa_scenario" | "diagnostic_risk" | "open_question"

interface MatrixRow {
  id: string
  sourceKind: RowKind
  requirementLabel: string
  artifactName: string
  artifactKind: string
  filePath: string
  traceType: TraceType
  certainty: string
  evidenceLabel: string
  reviewStatus: string
  originalLink?: TraceabilityLink
  originalInsight?: Insight
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
  const [traceTypeFilter, setTraceTypeFilter] = useState<string>("ALL")
  const [certaintyFilter, setCertaintyFilter] = useState<string>("ALL")
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>("ALL")
  const [artifactKindFilter, setArtifactKindFilter] = useState<string>("ALL")

  const rows = useMemo(() => {
    const requirementLabel = analysis.requirement.revisionTitle
    const generatedRows: MatrixRow[] = []

    // 1. Process Links (EVIDENCED and INFERRED Impacts)
    for (const link of links) {
      const node = graphNodes.find(n => n.id === `artifact-${link.artifactId}`)
      const isEvidenced = link.linkBasis === "EVIDENCED"
      
      let filePath = "—"
      if (link.evidence.length > 0 && link.evidence[0].filePath) {
        filePath = link.evidence[0].filePath
      } else if (node?.filePath) {
        filePath = node.filePath
      }

      generatedRows.push({
        id: link.id,
        sourceKind: "traceability_link",
        requirementLabel,
        artifactName: node?.label ?? link.evidence[0]?.artifactKey ?? "Unknown Artifact",
        artifactKind: node?.type ?? "UNKNOWN",
        filePath,
        traceType: isEvidenced ? "EVIDENCE_BACKED_IMPACT" : "INFERRED_IMPACT",
        certainty: isEvidenced ? "EVIDENCED" : "INFERRED",
        evidenceLabel: link.evidence.length > 0 ? `${link.evidence.length} items` : "—",
        reviewStatus: link.reviewStatus,
        originalLink: link,
      })
    }

    // 2. Process Insights (UNKNOWN/RISK, QA, QUESTIONS)
    for (const insight of insights) {
      let traceType: TraceType
      let sourceKind: RowKind
      if (insight.category === "QA_SCENARIO") {
        traceType = "QA_COVERAGE"
        sourceKind = "qa_scenario"
      } else if (insight.category === "QUESTION") {
        traceType = "OPEN_QUESTION"
        sourceKind = "open_question"
      } else if (insight.category === "UNKNOWN" || insight.category === "CLAIM") {
        traceType = "DIAGNOSTIC_DERIVED_RISK"
        sourceKind = "diagnostic_risk"
      } else {
        continue // Skip acceptance criteria or others not relevant to matrix MVP
      }

      let filePath = "—"
      if (insight.evidence.length > 0 && insight.evidence[0].filePath) {
        filePath = insight.evidence[0].filePath
      }

      let artifactName = insight.statement
      if (artifactName.length > 60) {
        artifactName = artifactName.substring(0, 60) + "..."
      }

      generatedRows.push({
        id: insight.id,
        sourceKind,
        requirementLabel,
        artifactName,
        artifactKind: "INSIGHT",
        filePath,
        traceType,
        certainty: insight.certainty,
        evidenceLabel: insight.evidence.length > 0 ? `${insight.evidence.length} items` : "—",
        reviewStatus: insight.reviewStatus,
        originalInsight: insight,
      })
    }

    // 3. Sort logic
    const traceTypeOrder: Record<TraceType, number> = {
      EVIDENCE_BACKED_IMPACT: 1,
      INFERRED_IMPACT: 2,
      DIAGNOSTIC_DERIVED_RISK: 3,
      QA_COVERAGE: 4,
      OPEN_QUESTION: 5,
    }

    generatedRows.sort((a, b) => {
      // First by requirement (all same here), then traceType, then name
      const orderDiff = traceTypeOrder[a.traceType] - traceTypeOrder[b.traceType]
      if (orderDiff !== 0) return orderDiff
      return a.artifactName.localeCompare(b.artifactName)
    })

    return generatedRows
  }, [analysis, insights, links, graphNodes])

  // Get unique artifact kinds for filter
  const uniqueKinds = useMemo(() => Array.from(new Set(rows.map(r => r.artifactKind))).sort(), [rows])

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (traceTypeFilter !== "ALL" && r.traceType !== traceTypeFilter) return false
      if (certaintyFilter !== "ALL" && r.certainty !== certaintyFilter) return false
      if (reviewStatusFilter !== "ALL" && r.reviewStatus !== reviewStatusFilter) return false
      if (artifactKindFilter !== "ALL" && r.artifactKind !== artifactKindFilter) return false

      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase()
        return (
          r.artifactName.toLowerCase().includes(lowerSearch) ||
          r.filePath.toLowerCase().includes(lowerSearch) ||
          r.traceType.toLowerCase().includes(lowerSearch)
        )
      }
      return true
    })
  }, [rows, searchTerm, traceTypeFilter, certaintyFilter, reviewStatusFilter, artifactKindFilter])

  const handleRowClick = (row: MatrixRow) => {
    if (row.originalLink) {
      onSelectLink(row.originalLink)
    } else if (row.originalInsight) {
      onSelectInsight(row.originalInsight)
    }
  }

  const reviewStatusColor = (status: string) => {
    switch (status) {
      case "NEEDS_REVIEW": return "bg-warning/10 text-warning"
      case "CONFIRMED": return "bg-success/10 text-success"
      case "REJECTED": return "bg-danger/10 text-danger"
      default: return "bg-surface-muted text-muted-foreground"
    }
  }

  const traceTypeDisplay = (type: TraceType) => {
    switch (type) {
      case "EVIDENCE_BACKED_IMPACT": return "Evidence Impact"
      case "INFERRED_IMPACT": return "Inferred Impact"
      case "DIAGNOSTIC_DERIVED_RISK": return "Risk / Unknown"
      case "QA_COVERAGE": return "QA Scenario"
      case "OPEN_QUESTION": return "Open Question"
      default: return type
    }
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
        <p>No traceability data available for this analysis.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex items-center gap-4 p-4 border-b border-border/40">
        <div className="relative w-64 shrink-0">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search artifacts, paths..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        
        <Select value={traceTypeFilter} onValueChange={setTraceTypeFilter}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Trace Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Trace Types</SelectItem>
            <SelectItem value="EVIDENCE_BACKED_IMPACT">Evidence Impact</SelectItem>
            <SelectItem value="INFERRED_IMPACT">Inferred Impact</SelectItem>
            <SelectItem value="DIAGNOSTIC_DERIVED_RISK">Risk / Unknown</SelectItem>
            <SelectItem value="QA_COVERAGE">QA Scenario</SelectItem>
          </SelectContent>
        </Select>

        <Select value={certaintyFilter} onValueChange={setCertaintyFilter}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Certainty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Certainty</SelectItem>
            <SelectItem value="EVIDENCED">EVIDENCED</SelectItem>
            <SelectItem value="INFERRED">INFERRED</SelectItem>
            <SelectItem value="UNKNOWN">UNKNOWN</SelectItem>
          </SelectContent>
        </Select>

        <Select value={reviewStatusFilter} onValueChange={setReviewStatusFilter}>
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue placeholder="Review Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Reviews</SelectItem>
            <SelectItem value="NEEDS_REVIEW">Needs Review</SelectItem>
            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={artifactKindFilter} onValueChange={setArtifactKindFilter}>
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue placeholder="Artifact Kind" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Kinds</SelectItem>
            {uniqueKinds.map(k => (
              <SelectItem key={k} value={k}>{k}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Requirement</TableHead>
              <TableHead className="w-[250px]">Artifact / Item</TableHead>
              <TableHead className="w-[100px]">Kind</TableHead>
              <TableHead>Path</TableHead>
              <TableHead className="w-[150px]">Trace Type</TableHead>
              <TableHead className="w-[120px]">Certainty</TableHead>
              <TableHead className="w-[100px]">Evidence</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No matching rows found.
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => (
                  <TableRow 
                    key={row.id} 
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      row.sourceKind === "diagnostic_risk" ? "bg-warning-soft" : ""
                    }`}
                    onClick={() => handleRowClick(row)}
                  >
                  <TableCell className="font-medium text-xs text-muted-foreground truncate max-w-[200px]" title={row.requirementLabel}>
                    {row.requirementLabel}
                  </TableCell>
                  <TableCell className="font-mono text-sm max-w-[250px] truncate" title={row.artifactName}>
                    {row.artifactName}
                  </TableCell>
                  <TableCell>
                    {row.artifactKind !== "INSIGHT" ? (
                      <ArtifactKindBadge kind={row.artifactKind as Parameters<typeof ArtifactKindBadge>[0]["kind"]} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[200px]" title={row.filePath}>
                    {row.filePath}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-medium text-muted-foreground">
                      {traceTypeDisplay(row.traceType)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <CertaintyBadge certainty={row.certainty as Parameters<typeof CertaintyBadge>[0]["certainty"]} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.evidenceLabel}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${reviewStatusColor(row.reviewStatus)}`}>
                      {row.reviewStatus.replace('_', ' ')}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
