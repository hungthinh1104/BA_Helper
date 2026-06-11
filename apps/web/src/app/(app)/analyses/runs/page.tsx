"use client"

import Link from "next/link"
import { AlertCircle, FolderGit2 } from "lucide-react"
import { WorkspacePageHeader } from "@/components/workspace/page-header"
import { DataList, DataListCell, DataListHeader, DataListRow } from "@/components/workspace/data-list"
import { Skeleton } from "@/components/ui/skeleton"
import { useMultiRepoAnalysisRuns } from "@/hooks/api/use-analyses"

const gridCols = "minmax(220px, 2.4fr) minmax(150px, 1.2fr) 110px minmax(170px, 1.5fr) 120px"

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatStatusCounts(counts: Record<string, number>) {
  const entries = [
    ["Queued", counts.QUEUED],
    ["Running", counts.RUNNING],
    ["Review", counts.WAITING_FOR_REVIEW],
    ["Done", counts.COMPLETED],
    ["Failed", counts.FAILED],
    ["Cancelled", counts.CANCELLED],
  ].filter(([, count]) => count > 0)

  if (entries.length === 0) {
    return "No child analyses"
  }

  return entries.map(([label, count]) => `${label} ${count}`).join(" • ")
}

export default function MultiRepoRunsPage() {
  const { data, isLoading, error } = useMultiRepoAnalysisRuns()

  return (
    <div className="app-page-scroll">
      <div className="max-w-5xl mx-auto w-full py-4">
        <WorkspacePageHeader
          title="Multi-repo Runs"
          description="Grouped runs created from one requirement revision across multiple repositories."
        >
          <Link href="/analyses" className="text-[12px] text-muted-foreground hover:text-foreground">
            Back to analyses
          </Link>
        </WorkspacePageHeader>

        <DataList>
          <DataListHeader gridCols={gridCols}>
            <DataListCell>Requirement</DataListCell>
            <DataListCell>Created By</DataListCell>
            <DataListCell>Analyses</DataListCell>
            <DataListCell>Status Summary</DataListCell>
            <DataListCell>Created</DataListCell>
          </DataListHeader>

          {isLoading && (
            <>
              {[1, 2, 3].map((item) => (
                <DataListRow key={item} gridCols={gridCols}>
                  <DataListCell><Skeleton className="h-4 w-[220px]" /></DataListCell>
                  <DataListCell><Skeleton className="h-4 w-[120px]" /></DataListCell>
                  <DataListCell><Skeleton className="h-4 w-[60px]" /></DataListCell>
                  <DataListCell><Skeleton className="h-4 w-[180px]" /></DataListCell>
                  <DataListCell><Skeleton className="h-4 w-[100px]" /></DataListCell>
                </DataListRow>
              ))}
            </>
          )}

          {error && !isLoading && (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <AlertCircle className="w-6 h-6 text-destructive mb-4" />
              <p className="text-[13px] font-medium text-foreground">Failed to load multi-repo runs</p>
              <p className="text-[12px]">{error.message}</p>
            </div>
          )}

          {!isLoading && !error && data?.items.length === 0 && (
            <div className="flex flex-col items-center text-center py-16 text-muted-foreground">
              <div className="w-12 h-12 rounded-lg bg-surface border border-border/50 flex items-center justify-center mb-4">
                <FolderGit2 className="w-5 h-5" />
              </div>
              <p className="text-[13px] font-medium text-foreground mb-1">No multi-repo runs yet</p>
              <p className="text-[12px]">Create a multi-repo analysis from the analyses page to see grouped runs here.</p>
            </div>
          )}

          {data?.items.map((run) => (
            <DataListRow
              key={run.runId}
              gridCols={gridCols}
              href={`/analyses/runs/${run.runId}`}
            >
              <DataListCell>
                <div className="font-medium text-[13px] text-foreground leading-snug">{run.requirementTitle}</div>
                <div className="text-muted-foreground text-[11px] font-mono mt-0.5">{run.runId}</div>
              </DataListCell>
              <DataListCell>
                <span className="text-[13px] text-muted-foreground">{run.createdBy}</span>
              </DataListCell>
              <DataListCell>
                <span className="text-[13px] font-medium text-foreground">{run.analysisCount}</span>
              </DataListCell>
              <DataListCell>
                <span className="text-[12px] text-muted-foreground">{formatStatusCounts(run.statusCounts)}</span>
              </DataListCell>
              <DataListCell>
                <span className="text-[12px] text-muted-foreground">{formatDate(run.createdAt)}</span>
              </DataListCell>
            </DataListRow>
          ))}
        </DataList>
      </div>
    </div>
  )
}
