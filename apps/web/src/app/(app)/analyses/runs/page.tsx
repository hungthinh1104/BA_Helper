"use client"

import Link from "next/link"
import { AlertCircle, FolderGit2 } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { WorkspacePageHeader } from "@/components/workspace/shared/page-header"
import { DataList, DataListCell, DataListHeader, DataListRow } from "@/components/workspace/shared/data-list"
import { Skeleton } from "@/components/ui/skeleton"
import { useMultiRepoAnalysisRuns } from "@/hooks/api/use-analyses"
import { useLocalizedHref } from "@/i18n/navigation"

const gridCols = "minmax(220px, 2.4fr) minmax(150px, 1.2fr) 110px minmax(170px, 1.5fr) 120px"

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatStatusCounts(counts: Record<string, number>, t: ReturnType<typeof useTranslations>) {
  const entries: [string, number][] = [
    [t("queued"), counts.QUEUED],
    [t("running"), counts.RUNNING],
    [t("review"), counts.WAITING_FOR_REVIEW],
    [t("done"), counts.COMPLETED],
    [t("failed"), counts.FAILED],
    [t("cancelled"), counts.CANCELLED],
  ];

  const filtered = entries.filter(([, count]) => count > 0);

  if (filtered.length === 0) {
    return t("noChildAnalyses")
  }

  return filtered.map(([label, count]) => `${label} ${count}`).join(" • ")
}

export default function MultiRepoRunsPage() {
  const t = useTranslations("workspaceLists")
  const locale = useLocale()
  const href = useLocalizedHref()
  const { data, isLoading, error } = useMultiRepoAnalysisRuns()

  return (
    <div className="app-page-scroll">
      <div className="max-w-5xl mx-auto w-full py-4">
        <WorkspacePageHeader
          title={t("multiRepoRunsTitle")}
          description={t("multiRepoRunsDescription")}
        >
          <Link href={href("/analyses")} className="text-[12px] text-muted-foreground hover:text-foreground">
            {t("backToAnalyses")}
          </Link>
        </WorkspacePageHeader>

        <DataList>
          <DataListHeader gridCols={gridCols}>
            <DataListCell>{t("requirement")}</DataListCell>
            <DataListCell>{t("createdBy")}</DataListCell>
            <DataListCell>{t("analysesTitle")}</DataListCell>
            <DataListCell>{t("statusSummary")}</DataListCell>
            <DataListCell>{t("created")}</DataListCell>
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
              <p className="text-[13px] font-medium text-foreground">{t("failedToLoadMultiRepoRuns")}</p>
              <p className="text-[12px]">{error.message}</p>
            </div>
          )}

          {!isLoading && !error && data?.items.length === 0 && (
            <div className="flex flex-col items-center text-center py-16 text-muted-foreground">
              <div className="w-12 h-12 rounded-lg bg-surface border border-border/50 flex items-center justify-center mb-4">
                <FolderGit2 className="w-5 h-5" />
              </div>
              <p className="text-[13px] font-medium text-foreground mb-1">{t("noMultiRepoRuns")}</p>
              <p className="text-[12px]">{t("noMultiRepoRunsDescription")}</p>
            </div>
          )}

          {data?.items.map((run) => (
            <DataListRow
              key={run.runId}
              gridCols={gridCols}
              href={href(`/analyses/runs/${run.runId}`)}
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
                <span className="text-[12px] text-muted-foreground">{formatStatusCounts(run.statusCounts, t)}</span>
              </DataListCell>
              <DataListCell>
                <span className="text-[12px] text-muted-foreground">{formatDate(run.createdAt, locale)}</span>
              </DataListCell>
            </DataListRow>
          ))}
        </DataList>
      </div>
    </div>
  )
}
