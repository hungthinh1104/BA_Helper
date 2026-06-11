"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { WorkspacePageHeader } from "@/components/workspace/page-header"
import { DataList, DataListHeader, DataListRow, DataListCell } from "@/components/workspace/data-list"
import { NewAnalysisDialog } from "@/components/workspace/new-analysis-dialog"
import { useAnalyses } from "@/hooks/api/use-analyses"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, AlertCircle, Activity } from "lucide-react"

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  QUEUED:             { label: "Queued",       className: "bg-border text-muted-foreground border-border/50" },
  RUNNING:            { label: "Running",      className: "bg-primary/10 text-primary border-primary/50" },
  WAITING_FOR_REVIEW: { label: "Needs Review", className: "bg-warning/10 text-warning border-warning/50" },
  COMPLETED:          { label: "Completed",    className: "bg-success/10 text-success border-success/50" },
  FAILED:             { label: "Failed",       className: "bg-destructive/10 text-destructive border-destructive/50" },
  CANCELLED:          { label: "Cancelled",    className: "bg-muted text-muted-foreground border-border/50" },
}

const gridCols = "minmax(200px, 2.5fr) minmax(150px, 1.5fr) 130px 90px"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function AnalysesPage() {
  const { data, isLoading, error } = useAnalyses()

  return (
    <div className="app-page-scroll">
      <div className="max-w-4xl mx-auto w-full py-4">
        <WorkspacePageHeader
          title="Impact Analyses"
          description="Manage and view requirement impact analyses linked to repository snapshots."
        >
          <div className="flex items-center gap-2">
            <Link href="/analyses/runs" className="text-[12px] text-muted-foreground hover:text-foreground">
              Multi-repo Runs
            </Link>
            <NewAnalysisDialog>
              <Button size="sm" className="h-8 shadow-none gap-1.5">
                <Plus className="w-3.5 h-3.5" /> New Analysis
              </Button>
            </NewAnalysisDialog>
          </div>
        </WorkspacePageHeader>

        <DataList>
          <DataListHeader gridCols={gridCols}>
            <DataListCell>Requirement</DataListCell>
            <DataListCell>Repository</DataListCell>
            <DataListCell>Status</DataListCell>
            <DataListCell>Created</DataListCell>
          </DataListHeader>

          {isLoading && (
            <>
              {[1, 2, 3].map((i) => (
                <DataListRow key={i} gridCols={gridCols}>
                  <DataListCell><Skeleton className="h-4 w-[180px]" /></DataListCell>
                  <DataListCell><Skeleton className="h-4 w-[120px]" /></DataListCell>
                  <DataListCell><Skeleton className="h-5 w-[80px] rounded-md" /></DataListCell>
                  <DataListCell><Skeleton className="h-4 w-[60px]" /></DataListCell>
                </DataListRow>
              ))}
            </>
          )}

          {error && (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <AlertCircle className="w-6 h-6 text-destructive mb-4" />
              <p className="text-[13px] font-medium text-foreground">Failed to load analyses</p>
              <p className="text-[12px]">{error.message}</p>
            </div>
          )}

          {!isLoading && !error && data?.items.length === 0 && (
            <div className="flex flex-col items-center text-center py-16 text-muted-foreground">
              <div className="w-12 h-12 rounded-lg bg-surface border border-border/50 flex items-center justify-center mb-4">
                <Activity className="w-5 h-5" />
              </div>
              <p className="text-[13px] font-medium text-foreground mb-1">No analyses yet</p>
              <p className="text-[12px] mb-4">Run your first impact analysis to see results here.</p>
              <NewAnalysisDialog>
                <Button size="sm" variant="outline" className="h-8 shadow-none gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Start Analysis
                </Button>
              </NewAnalysisDialog>
            </div>
          )}

          {data?.items.map(analysis => {
            const badge = STATUS_BADGE[analysis.status] ?? STATUS_BADGE.QUEUED
            const isRunning = analysis.status === "RUNNING"

            return (
              <DataListRow
                key={analysis.id}
                gridCols={gridCols}
                href={`/analyses/${analysis.id}`}
              >
                <DataListCell>
                  <div className="font-medium text-[13px] text-foreground leading-snug">{analysis.requirementRevisionTitle}</div>
                  <div className="text-muted-foreground text-[11px] font-mono mt-0.5">{analysis.snapshotCommitSha.substring(0, 7)}</div>
                </DataListCell>
                <DataListCell>
                  <span className="text-[13px] font-mono text-muted-foreground">{analysis.repositoryDisplayName}</span>
                </DataListCell>
                <DataListCell>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 border rounded-md text-[10px] font-semibold tracking-wide uppercase ${badge.className}`}>
                    {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                    {badge.label}
                  </span>
                </DataListCell>
                <DataListCell>
                  <span className="text-[12px] text-muted-foreground">{formatDate(analysis.createdAt)}</span>
                </DataListCell>
              </DataListRow>
            )
          })}
        </DataList>
      </div>
    </div>
  )
}
