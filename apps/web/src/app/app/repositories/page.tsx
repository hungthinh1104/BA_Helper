"use client"

import { AppShell } from "@/components/layout/app-shell"
import { WorkspacePageHeader } from "@/components/workspace/page-header"
import { DataList, DataListHeader, DataListRow, DataListCell } from "@/components/workspace/data-list"
import { ConnectRepoDialog } from "@/components/workspace/connect-repo-dialog"
import { ScanJobProgress, ScanJobStatus } from "@/components/workspace/scan-job-progress"
import { Button } from "@/components/ui/button"
import { useRepositories } from "@/hooks/api/use-repositories"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, RefreshCw, AlertCircle } from "lucide-react"

const gridCols = "minmax(180px, 2fr) minmax(120px, 1.5fr) 80px minmax(180px, 2fr) 90px"

export default function RepositoriesPage() {
  const { data, isLoading, error } = useRepositories("default-project")

  // Rescan will need a mutation hook later
  const handleRescan = (repoId: string) => {
    console.log("Rescan not fully implemented yet", repoId)
  }

  return (
    <AppShell>
      <div className="app-page-scroll">
        <div className="max-w-4xl mx-auto w-full py-4">
        <WorkspacePageHeader
          title="Repositories"
          description="Connect public GitHub repositories to scan their codebase for impact analysis."
        >
          <ConnectRepoDialog>
            <Button size="sm" className="h-8 shadow-none gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Connect Repository
            </Button>
          </ConnectRepoDialog>
        </WorkspacePageHeader>

        <DataList>
          <DataListHeader gridCols={gridCols}>
            <DataListCell>Repository</DataListCell>
            <DataListCell>URL</DataListCell>
            <DataListCell>Ref</DataListCell>
            <DataListCell>Scan Status</DataListCell>
            <DataListCell className="text-right">Actions</DataListCell>
          </DataListHeader>

          {isLoading && (
            <>
              {[1, 2, 3].map((i) => (
                <DataListRow key={i} gridCols={gridCols}>
                  <DataListCell><Skeleton className="h-4 w-[120px]" /></DataListCell>
                  <DataListCell><Skeleton className="h-4 w-[160px]" /></DataListCell>
                  <DataListCell><Skeleton className="h-4 w-[40px]" /></DataListCell>
                  <DataListCell><Skeleton className="h-4 w-[100px]" /></DataListCell>
                  <DataListCell className="justify-end"><Skeleton className="h-6 w-[60px]" /></DataListCell>
                </DataListRow>
              ))}
            </>
          )}

          {error && (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <AlertCircle className="w-6 h-6 text-destructive mb-4" />
              <p className="text-[13px] font-medium text-foreground">Failed to load repositories</p>
              <p className="text-[12px]">{error.message}</p>
            </div>
          )}

          {!isLoading && !error && data?.items.length === 0 && (
            <div className="flex flex-col items-center text-center py-16 text-muted-foreground">
              <p className="text-[13px] font-medium text-foreground mb-1">No repositories connected</p>
              <p className="text-[12px]">Connect a public GitHub repository to begin scanning.</p>
            </div>
          )}

          {data?.items.map(repo => {
            const job = repo.latestScanJob
            const isActive = job && (job.status === "QUEUED" || job.status === "RUNNING")
            const canRescan = job?.canCancel === false

            return (
              <DataListRow key={repo.id} gridCols={gridCols} href={`/app/repositories/${repo.id}`}>
                {/* Repository name + framework */}
                <DataListCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-medium text-foreground font-mono">{repo.displayName}</span>
                    <span className="text-[11px] text-muted-foreground">{repo.framework || "Unknown"}</span>
                  </div>
                </DataListCell>

                {/* Canonical URL */}
                <DataListCell>
                  <span className="block text-[12px] text-muted-foreground truncate font-mono" title={repo.canonicalUrl}>
                    {repo.canonicalUrl.replace("https://github.com/", "")}
                  </span>
                </DataListCell>

                {/* Branch/Ref */}
                <DataListCell>
                  <span className="text-[12px] font-mono text-foreground/70 px-1.5 py-0.5 bg-surface-muted rounded border border-border/60">
                    {repo.latestTarget?.requestedRef || "main"}
                  </span>
                </DataListCell>

                {/* Scan job status (with progress if active) */}
                <DataListCell>
                  {isActive && job ? (
                    <ScanJobProgress job={job} snapshot={repo.latestSnapshot} />
                  ) : job ? (
                    <div className="flex flex-col gap-1">
                      <ScanJobStatus job={job} />
                      {repo.latestSnapshot?.analyzerVersion && (
                        <span className="text-[10px] font-mono text-muted-foreground/60">{repo.latestSnapshot.analyzerVersion}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[12px] text-muted-foreground">No jobs</span>
                  )}
                </DataListCell>

                {/* Actions */}
                <DataListCell className="text-right">
                  {canRescan && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground shadow-none gap-1"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleRescan(repo.id)
                      }}
                    >
                      <RefreshCw className="w-3 h-3" /> Re-scan
                    </Button>
                  )}
                </DataListCell>
              </DataListRow>
            )
          })}
        </DataList>
        </div>
      </div>
    </AppShell>
  )
}
