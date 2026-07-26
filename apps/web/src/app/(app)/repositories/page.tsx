"use client"


import { WorkspacePageHeader } from "@/components/workspace/shared/page-header"
import { useCurrentWorkspace } from "@/lib/project-context"
import { canManageRepository, canRunScan } from "@/lib/permissions"
import { DataList, DataListHeader, DataListRow, DataListCell } from "@/components/workspace/shared/data-list"
import { ConnectRepoDialog } from "@/components/workspace/repository/connect-repo-dialog"
import { ScanJobProgress, ScanJobStatus } from "@/components/workspace/repository/scan-job-progress"
import { Button } from "@/components/ui/button"
import { useRepositories } from "@/hooks/api/use-repositories"
import { useCreateScanJob } from "@/hooks/api/use-scan-jobs"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, RefreshCw, AlertCircle, GitBranch } from "lucide-react"
import { toast } from "sonner"
import { v4 as uuidv4 } from "uuid"
import { useTranslations } from "next-intl"
import { useLocalizedHref } from "@/i18n/navigation"

const gridCols = "minmax(180px, 2fr) minmax(120px, 1.5fr) 80px minmax(180px, 2fr) 90px"

export default function RepositoriesPage() {
  const t = useTranslations("workspaceLists")
  const href = useLocalizedHref()
  const { data, isLoading, error } = useRepositories()
  const { mutateAsync: createScanJob, isPending: isRescanning } = useCreateScanJob(undefined)
  const workspace = useCurrentWorkspace()
  const canManageRepo = workspace ? canManageRepository(workspace.membershipRole) : false
  const canScan = workspace ? canRunScan(workspace.membershipRole) : false

  const handleRescan = async (repoId: string) => {
    try {
      await createScanJob({
        repositoryId: repoId,
        requestKey: uuidv4(),
      })
      toast.success(t("scanQueued"), {
        description: t("scanQueuedDescription"),
      })
    } catch (err) {
      toast.error(t("failedQueueScan"), {
        description: err instanceof Error ? err.message : t("pleaseTryAgain"),
      })
    }
  }

  return (
    <div className="app-page-scroll">
        <div className="max-w-4xl mx-auto w-full py-4">
        <WorkspacePageHeader
          title={t("repositoriesTitle")}
          description={t("repositoriesDescription")}
        >
          <ConnectRepoDialog>
            <Button size="sm" className="h-8 shadow-none gap-1.5" disabled={!canManageRepo} title={!canManageRepo ? t("maintainerRequiredConnect") : undefined}>
              <Plus className="w-3.5 h-3.5" /> {t("connectRepository")}
            </Button>
          </ConnectRepoDialog>
        </WorkspacePageHeader>

        <DataList>
          <DataListHeader gridCols={gridCols}>
            <DataListCell>{t("repository")}</DataListCell>
            <DataListCell>{t("url")}</DataListCell>
            <DataListCell>{t("ref")}</DataListCell>
            <DataListCell>{t("scanStatus")}</DataListCell>
            <DataListCell className="text-right">{t("actions")}</DataListCell>
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
              <p className="text-[13px] font-medium text-foreground">{t("failedToLoadRepositories")}</p>
              <p className="text-[12px]">{error.message}</p>
            </div>
          )}

          {!isLoading && !error && data?.items.length === 0 && (
            <div className="flex flex-col items-center text-center py-16 text-muted-foreground">
              <div className="w-12 h-12 rounded-lg bg-surface border border-border/50 flex items-center justify-center mb-4">
                <GitBranch className="w-5 h-5" />
              </div>
              <p className="text-[13px] font-medium text-foreground mb-1">{t("noRepositoriesConnected")}</p>
              <p className="text-[12px] mb-4">{t("connectRepositoryEmpty")}</p>
              <ConnectRepoDialog>
                <Button size="sm" variant="outline" className="h-8 shadow-none gap-1.5" disabled={!canManageRepo} title={!canManageRepo ? t("maintainerRequiredConnect") : undefined}>
                  <Plus className="w-3.5 h-3.5" /> {t("connectRepository")}
                </Button>
              </ConnectRepoDialog>
            </div>
          )}

          {data?.items.map(repo => {
            const job = repo.latestScanJob
            const isActive = job && (job.status === "QUEUED" || job.status === "RUNNING")
            const canRescan = job?.canCancel === false

            return (
              <DataListRow key={repo.id} gridCols={gridCols} href={href(`/repositories/${repo.id}`)}>
                {/* Repository name + framework */}
                <DataListCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-medium text-foreground font-mono">{repo.displayName}</span>
                    <span className="text-[11px] text-muted-foreground">{repo.framework || t("unknown")}</span>
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
                    <span className="text-[12px] text-muted-foreground">{t("noJobs")}</span>
                  )}
                </DataListCell>

                {/* Actions */}
                <DataListCell className="text-right">
                  {canRescan && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 px-2 text-[11px] shadow-none gap-1 ${!canScan ? 'opacity-40 cursor-not-allowed' : 'text-muted-foreground hover:text-foreground'}`}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (canScan) {
                          void handleRescan(repo.id)
                        }
                      }}
                      disabled={isRescanning || !canScan}
                      title={!canScan ? t("maintainerRequiredScan") : undefined}
                    >
                      <RefreshCw className="w-3 h-3" /> {isRescanning ? t("queuing") : t("rescan")}
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
