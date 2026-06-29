import React from "react"
import Link from "next/link"
import { AlertCircle } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { useMultiRepoImpactMatrix } from "@/hooks/api/use-analyses"
import { MULTI_REPO_CHILD_BLOCKING_REASON_LABEL } from "@/lib/multi-repo-report-labels"

interface ImpactMatrixTableProps {
  runId: string
  onViewDetails: (analysisId: string) => void
}

export function ImpactMatrixTable({ runId, onViewDetails }: ImpactMatrixTableProps) {
  const { data, isLoading, error } = useMultiRepoImpactMatrix(runId)

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Loading matrix...</div>
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center py-8 text-muted-foreground">
        <AlertCircle className="w-5 h-5 text-destructive mb-2" />
        <p className="text-[13px] font-medium text-foreground">Failed to load impact matrix</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Domain</TableHead>
            <TableHead>Repository</TableHead>
            <TableHead className="text-right">API</TableHead>
            <TableHead className="text-right">Service</TableHead>
            <TableHead className="text-right">Data</TableHead>
            <TableHead className="text-right">Test</TableHead>
            <TableHead className="text-right">Risks</TableHead>
            <TableHead className="text-right">QA</TableHead>
            <TableHead>Review</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((row: import("@ba-helper/contracts").MultiRepoImpactMatrixRow) => (
            <TableRow key={row.analysisId}>
              <TableCell className="font-medium">{row.domain}</TableCell>
              <TableCell>
                <Link href={`/analyses/${row.analysisId}`} className="hover:underline text-primary">
                  {row.repositoryDisplayName}
                </Link>
              </TableCell>
              <TableCell className="text-right">{row.artifactCounts.API_ENDPOINT || "-"}</TableCell>
              <TableCell className="text-right">{row.artifactCounts.DOMAIN_SERVICE || "-"}</TableCell>
              <TableCell className="text-right">{row.artifactCounts.DATA_MODEL || "-"}</TableCell>
              <TableCell className="text-right">{row.artifactCounts.TEST_CASE || "-"}</TableCell>
              <TableCell className="text-right">
                {row.riskCount > 0 ? (
                  <span className="text-destructive font-medium">{row.riskCount}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">{row.qaScenarioCount || "-"}</TableCell>
              <TableCell>
                {row.latestReviewDecision === "ACCEPTED" ? (
                  <span className="text-success font-medium">Accepted</span>
                ) : row.latestReviewDecision === "REJECTED" ? (
                  <span className="text-destructive font-medium">Rejected</span>
                ) : row.latestReviewDecision === "NEEDS_MORE_CLARIFICATION" ? (
                  <span className="text-warning font-medium">Clarification</span>
                ) : (
                  <span className="text-muted-foreground">Pending</span>
                )}
              </TableCell>
              <TableCell>
                <span className={`text-[12px] ${row.blockingReason === "NONE" ? "text-success" : "text-warning"}`}>
                  {MULTI_REPO_CHILD_BLOCKING_REASON_LABEL[row.blockingReason || "NONE"]}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onViewDetails(row.analysisId)}
                >
                  View details
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {data.rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={11} className="text-center text-muted-foreground h-24">
                No repositories found in this run.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
