"use client"


import { WorkspacePageHeader } from "@/components/workspace/shared/page-header"
import { DataList, DataListHeader, DataListRow, DataListCell } from "@/components/workspace/shared/data-list"
import { ConnectRepoDialog } from "@/components/workspace/repository/connect-repo-dialog"
import { ScanJobProgress, ScanJobStatus } from "@/components/workspace/repository/scan-job-progress"
import { Button } from "@/components/ui/button"
import { useRepositories } from "@/hooks/api/use-repositories"
import { useCreateScanJob } from "@/hooks/api/use-scan-jobs"
import { useAuth } from "@/hooks/use-auth"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, RefreshCw, AlertCircle, GitBranch } from "lucide-react"
import { toast } from "sonner"
import { v4 as uuidv4 } from "uuid"

const gridCols = "minmax(180px, 2fr) minmax(120px, 1.5fr) 80px minmax(180px, 2fr) 90px"

export default function RepositoriesPage() {
  const { data, isLoading, error } = useRepositories()
  const { mutateAsync: createScanJob, isPending: isRescanning } = useCreateScanJob(undefined)
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const handleRescan = async (repoId: string) => {
    try {
      await createScanJob({
        repositoryId: repoId,
        requestKey: uuidv4(),
      })
      toast.success("Scan queued", {
        description: "The repository scan has been queued again.",
      })
    } catch (err) {
      toast.error("Failed to queue scan", {
        description: err instanceof Error ? err.message : "Please try again.",
      })
    }
  }

  return (
    <div className="app-page-scroll">
        <div className="max-w-4xl mx-auto w-full py-4">
        <WorkspacePageHeader
          title="Repositories"
          description="Connect public GitHub repositories to scan their codebase for impact analysis."
        >
          <ConnectRepoDialog>
            <Button size="sm" className="h-8 shadow-none gap-1.5" disabled={!isAdmin} title={!isAdmin ? "Admin role required to connect repositories." : undefined}>
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
              <div className="w-12 h-12 rounded-lg bg-surface border border-border/50 flex items-center justify-center mb-4">
                <GitBranch className="w-5 h-5" />
              </div>
              <p className="text-[13px] font-medium text-foreground mb-1">No repositories connected yet.</p>
              <p className="text-[12px] mb-4">Connect a public GitHub repository to start scanning backend code.</p>
              <ConnectRepoDialog>
                <Button size="sm" variant="outline" className="h-8 shadow-none gap-1.5" disabled={!isAdmin} title={!isAdmin ? "Admin role required to connect repositories." : undefined}>
                  <Plus className="w-3.5 h-3.5" /> Connect Repository
                </Button>
              </ConnectRepoDialog>
            </div>
          )}

          {data?.items.map(repo => {
            const job = repo.latestScanJob
            const isActive = job && (job.status === "QUEUED" || job.status === "RUNNING")
            const canRescan = job?.canCancel === false

            return (
              <DataListRow key={repo.id} gridCols={gridCols} href={`/repositories/${repo.id}`}>
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
                      {job.status === "FAILED" && job.error?.code && (
                        <span className="text-[11px] text-danger/80">
                          {job.error.code}: {job.error.message}
                        </span>
                      )}
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
                      className={`h-7 px-2 text-[11px] shadow-none gap-1 ${!isAdmin ? 'opacity-40 cursor-not-allowed' : 'text-muted-foreground hover:text-foreground'}`}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (isAdmin) {
                          void handleRescan(repo.id)
                        }
                      }}
                      disabled={isRescanning || !isAdmin}
                      title={!isAdmin ? "Admin role required to run scans." : undefined}
                    >
                      <RefreshCw className="w-3 h-3" /> {isRescanning ? "Queuing..." : "Re-scan"}
                    </Button>
                  )}
                </DataListCell>
              </DataListRow>
            )
          })}
        </DataList>
        </div>
      </div>
  )
}
