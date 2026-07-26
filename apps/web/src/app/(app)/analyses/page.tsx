"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { WorkspacePageHeader } from "@/components/workspace/shared/page-header"
import { AnalystSummaryBand } from "@/components/workspace/shared/analyst-summary-band"
import { DataList, DataListHeader, DataListRow, DataListCell } from "@/components/workspace/shared/data-list"
import { NewAnalysisDialog } from "@/components/workspace/analysis/new-analysis/new-analysis-dialog"
import { useAnalyses } from "@/hooks/api/use-analyses"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, AlertCircle, Activity, CheckCircle2, Clock, FileWarning } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useLocalizedHref } from "@/i18n/navigation"

import { AnalysisStatusBadge } from "@/components/workspace/shared/status-badges"

const gridCols = "minmax(200px, 2.5fr) minmax(150px, 1.5fr) 130px 90px"

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })
}

export default function AnalysesPage() {
  const t = useTranslations("workspaceLists")
  const locale = useLocale()
  const href = useLocalizedHref()
  const { data, isLoading, error } = useAnalyses()
  const analyses = useMemo(() => data?.items ?? [], [data?.items])
  const summary = useMemo(() => {
    return analyses.reduce(
      (acc, analysis) => {
        if (analysis.status === "QUEUED" || analysis.status === "RUNNING") acc.running += 1
        if (analysis.status === "WAITING_FOR_REVIEW") acc.review += 1
        if (analysis.status === "COMPLETED") acc.completed += 1
        if (analysis.isStale || analysis.status === "FAILED") acc.attention += 1
        return acc
      },
      {
        running: 0,
        review: 0,
        completed: 0,
        attention: 0,
      },
    )
  }, [analyses])

  return (
    <div className="app-page-scroll">
      <div className="max-w-4xl mx-auto w-full py-4">
        <WorkspacePageHeader
          title={t("analysesTitle")}
          description={t("analysesDescription")}
        >
          <div className="flex items-center gap-2">
            <NewAnalysisDialog>
              <Button size="sm" className="h-8 shadow-none gap-1.5">
                <Plus className="w-3.5 h-3.5" /> {t("newAnalysis")}
              </Button>
            </NewAnalysisDialog>
          </div>
        </WorkspacePageHeader>

        <AnalystSummaryBand
          title={t("analysisQueue")}
          description={
            summary.review > 0
              ? t("analysisQueueReviewDescription", { count: summary.review })
              : summary.running > 0
                ? t("analysisQueueRunningDescription", { count: summary.running })
                : t("analysisQueueStableDescription")
          }
          items={[
            {
              label: t("running"),
              value: isLoading ? "..." : summary.running,
              description: t("runningAnalysesMetric"),
              icon: <Activity className="h-4 w-4 text-primary" />,
            },
            {
              label: t("needsReview"),
              value: isLoading ? "..." : summary.review,
              description: t("needsReviewMetric"),
              icon: <Clock className="h-4 w-4 text-warning" />,
            },
            {
              label: t("completed"),
              value: isLoading ? "..." : summary.completed,
              description: t("completedAnalysesMetric"),
              icon: <CheckCircle2 className="h-4 w-4 text-success" />,
            },
            {
              label: t("attention"),
              value: isLoading ? "..." : summary.attention,
              description: t("attentionMetric"),
              icon: <FileWarning className="h-4 w-4 text-destructive" />,
            },
          ]}
        />

        <DataList>
          <DataListHeader gridCols={gridCols}>
            <DataListCell>{t("requirement")}</DataListCell>
            <DataListCell>{t("repository")}</DataListCell>
            <DataListCell>{t("status")}</DataListCell>
            <DataListCell>{t("created")}</DataListCell>
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
              <p className="text-[13px] font-medium text-foreground">{t("failedToLoadAnalyses")}</p>
              <p className="text-[12px]">{error.message}</p>
            </div>
          )}

          {!isLoading && !error && data?.items.length === 0 && (
            <div className="flex flex-col items-center text-center py-16 text-muted-foreground">
              <div className="w-12 h-12 rounded-lg bg-surface border border-border/50 flex items-center justify-center mb-4">
                <Activity className="w-5 h-5" />
              </div>
              <p className="text-[13px] font-medium text-foreground mb-1">{t("noAnalyses")}</p>
              <p className="text-[12px] mb-4">{t("noAnalysesDescription")}</p>
              <NewAnalysisDialog>
                <Button size="sm" variant="outline" className="h-8 shadow-none gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> {t("startAnalysis")}
                </Button>
              </NewAnalysisDialog>
            </div>
          )}

          {data?.items.map(analysis => {
            return (
              <DataListRow
                key={analysis.id}
                gridCols={gridCols}
                href={href(`/analyses/${analysis.id}`)}
              >
                <DataListCell>
                  <div className="font-medium text-[13px] text-foreground leading-snug">{analysis.requirementRevisionTitle}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono">{analysis.snapshotCommitSha.substring(0, 7)}</span>
                    {analysis.isStale ? (
                      <span className="rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-warning">
                        {t("stale")}
                      </span>
                    ) : null}
                    {analysis.error ? (
                      <span className="rounded border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-destructive">
                        {analysis.error.code}
                      </span>
                    ) : null}
                  </div>
                </DataListCell>
                <DataListCell>
                  <span className="text-[13px] font-mono text-muted-foreground">{analysis.repositoryDisplayName}</span>
                </DataListCell>
                <DataListCell>
                  <AnalysisStatusBadge status={analysis.status} />
                </DataListCell>
                <DataListCell>
                  <span className="text-[12px] text-muted-foreground">{formatDate(analysis.createdAt, locale)}</span>
                </DataListCell>
              </DataListRow>
            )
          })}
        </DataList>
      </div>
    </div>
  )
}
