"use client"

import { Fragment, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type {
  ImpactAnalysisResponse,
  ImpactGraphNode,
  InsightListResponse,
  TraceabilityLinkListResponse,
} from "@ba-helper/contracts"

import { useTraceabilityMatrix, TRACE_GROUPS, type MatrixRow } from "./matrix/use-traceability-matrix"
import { MatrixToolbar } from "./matrix/matrix-toolbar"
import { MatrixTableRow } from "./matrix/matrix-table-row"

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

export function AnalysisTraceabilityMatrixTab({
  analysis,
  insights,
  links,
  graphNodes = [],
  onSelectLink,
  onSelectInsight,
}: AnalysisTraceabilityMatrixTabProps) {
  const t = useTranslations("workspace")
  const matrix = useTraceabilityMatrix(insights, links, graphNodes)

  const handleRowClick = useCallback((row: MatrixRow) => {
    matrix.setSelectedRowId(row.id)
    if (row.originalLink) {
      onSelectLink(row.originalLink)
    } else if (row.originalInsight) {
      onSelectInsight(row.originalInsight)
    }
  }, [onSelectLink, onSelectInsight, matrix])

  if (matrix.rows.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-12 text-center text-muted-foreground">
        <p className="text-sm font-medium text-foreground">{t("noTraceabilityData")}</p>
        <p className="mt-2 text-sm opacity-70">
          {t("traceabilityMatrixWillPopulate")}
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      <MatrixToolbar
        summaryCounts={matrix.summaryCounts}
        searchTerm={matrix.searchTerm}
        traceTypeFilter={matrix.traceTypeFilter}
        certaintyFilter={matrix.certaintyFilter}
        reviewStatusFilter={matrix.reviewStatusFilter}
        hasActiveFilters={matrix.hasActiveFilters}
        onSearchChange={matrix.handleSearchChange}
        onTraceTypeChange={matrix.handleTraceTypeChange}
        onCertaintyChange={matrix.handleCertaintyChange}
        onReviewStatusChange={matrix.handleReviewStatusChange}
        onClearFilters={matrix.clearFilters}
      />

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-[980px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
              <TableRow className="h-8 text-xs hover:bg-transparent">
                <TableHead className="w-[280px] h-8 px-3">{t("artifactItem")}</TableHead>
                <TableHead className="w-[120px] h-8 px-3">{t("kind")}</TableHead>
                <TableHead className="w-[220px] h-8 px-3">{t("path")}</TableHead>
                <TableHead className="w-[170px] h-8 px-3">{t("traceType")}</TableHead>
                <TableHead className="w-[120px] h-8 px-3">{t("certainty")}</TableHead>
                <TableHead className="w-[120px] h-8 px-3">{t("evidence")}</TableHead>
                <TableHead className="w-[130px] h-8 px-3">{t("review")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrix.filteredRows.length > 0 && (
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={7} className="py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("requirement")}: {analysis.requirement.revisionTitle || analysis.requirement.id || t("currentRequirementChange")}
                    <span className="ml-2 font-normal lowercase">({t("rowsCount", { count: matrix.filteredRows.length })})</span>
                  </TableCell>
                </TableRow>
              )}

              {matrix.filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {t("noMatchingRows")}
                  </TableCell>
                </TableRow>
              ) : (
                TRACE_GROUPS.map(group => {
                  const rowsInGroup = matrix.pagedRows.filter(row => row.traceType === group.type)
                  if (rowsInGroup.length === 0) return null

                  return (
                    <Fragment key={group.type}>
                      <TableRow className="bg-surface-muted/30 hover:bg-surface-muted/30">
                        <TableCell colSpan={7} className="border-t py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground/70">
                          {t(`traceGroup.${group.type}`)} <span className="ml-1 opacity-70">({rowsInGroup.length})</span>
                        </TableCell>
                      </TableRow>
                      {rowsInGroup.map(row => (
                        <MatrixTableRow
                          key={row.id}
                          row={row}
                          selectedRowId={matrix.selectedRowId}
                          onRowClick={handleRowClick}
                        />
                      ))}
                    </Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="border-t border-border/40 px-4 py-3">
        <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            {t("showingRange", { start: matrix.visibleStart, end: matrix.pageEnd, total: matrix.filteredRows.length })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 shadow-none"
              onClick={() => matrix.setPage(matrix.currentPage - 1)}
              disabled={matrix.currentPage <= 1}
            >
              {t("prev")}
            </Button>
            <span className="min-w-[88px] text-center text-xs">
              {t("pageOf", { current: matrix.currentPage, total: matrix.totalPages })}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 shadow-none"
              onClick={() => matrix.setPage(matrix.currentPage + 1)}
              disabled={matrix.currentPage >= matrix.totalPages}
            >
              {t("next")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
