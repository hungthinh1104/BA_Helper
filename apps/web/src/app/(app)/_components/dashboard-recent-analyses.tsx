import { useMemo } from "react"
import Link from "next/link"
import { Activity, ChevronRight, FileText } from "lucide-react"
import { useTranslations } from "next-intl"
import { NewAnalysisDialog } from "@/components/workspace/analysis/new-analysis/new-analysis-dialog"
import { DataCard, EmptyState, SectionHeader } from "@/components/workspace/shared/primitives"
import { AnalysisStatusBadge } from "@/components/workspace/shared/status-badges"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useLocalizedHref } from "@/i18n/navigation"
import type { ImpactAnalysisListResponse } from "@ba-helper/contracts"

interface DashboardRecentAnalysesProps {
  analyses: ImpactAnalysisListResponse["items"]
  analysesLoading: boolean
  runningAnalyses: ImpactAnalysisListResponse["items"]
  canRun: boolean
}

export function DashboardRecentAnalyses({
  analyses,
  analysesLoading,
  runningAnalyses,
  canRun,
}: DashboardRecentAnalysesProps) {
  const t = useTranslations("dashboard")
  const href = useLocalizedHref()

  const sortedAnalyses = useMemo(() => {
    return [...analyses].sort((a, b) => {
      const rank = (status: string) => {
        if (status === "WAITING_FOR_REVIEW") return 0
        if (status === "FAILED") return 1
        if (status === "RUNNING" || status === "QUEUED") return 2
        if (status === "COMPLETED") return 3
        return 4
      }
      return rank(a.status) - rank(b.status)
    })
  }, [analyses])

  return (
    <section className="space-y-4">
      <SectionHeader
        title={t("recentAnalyses")}
        description={t("recentAnalysesDescription")}
        action={
          <Link href={href("/analyses")} className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">
            {t("viewAll")} <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        }
      />

      <DataCard>
        {analysesLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : analyses.length === 0 ? (
          <EmptyState
            title={t("noAnalyses")}
            description={t("noAnalysesDescription")}
            icon={<Activity className="h-5 w-5" />}
            action={
              canRun ? (
                <NewAnalysisDialog>
                  <Button size="sm" variant="outline" className="shadow-none">{t("startAnalysis")}</Button>
                </NewAnalysisDialog>
              ) : undefined
            }
          />
        ) : (
          <div className="divide-y divide-border/50">
            {sortedAnalyses.map(analysis => {
              const isFailed = analysis.status === "FAILED"
              const isReview = analysis.status === "WAITING_FOR_REVIEW"
              const isCompleted = analysis.status === "COMPLETED"

              return (
                <div key={analysis.id} className="flex items-center justify-between gap-4 px-4 py-4">
                  <div className="min-w-0 space-y-2">
                    <Link href={href(`/analyses/${analysis.id}`)} className="block truncate text-sm font-semibold text-foreground hover:underline">
                      {analysis.requirementRevisionTitle}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>{analysis.repositoryDisplayName}</span>
                      <span>·</span>
                      <span className="font-mono">{analysis.snapshotCommitSha.substring(0, 7)}</span>
                      <AnalysisStatusBadge status={analysis.status} />
                    </div>
                    {isFailed ? (
                      <p className="text-sm text-danger">
                        {analysis.error?.message ?? t("analysisFailedDetail")}
                      </p>
                    ) : runningAnalyses.some((item) => item.id === analysis.id) ? (
                      <p className="text-sm text-muted-foreground">
                        {t("backendProcessing")}
                      </p>
                    ) : null}
                  </div>

                  <div className="shrink-0">
                    {isReview ? (
                      <Link href={href(`/analyses/${analysis.id}?view=review`)}>
                        <Button size="sm" className="border border-warning/20 bg-warning/10 text-warning shadow-none hover:bg-warning/20">
                          {t("reviewQueue")}
                        </Button>
                      </Link>
                    ) : isCompleted ? (
                      <Link href={href(`/reports?analysisId=${analysis.id}`)}>
                        <Button size="sm" variant="outline" className="border-success/20 bg-success/10 text-success shadow-none hover:bg-success/20">
                          <FileText className="mr-1.5 h-4 w-4" />
                          {t("report")}
                        </Button>
                      </Link>
                    ) : (
                      <Link href={href(`/analyses/${analysis.id}`)}>
                        <Button size="sm" variant="outline" className="shadow-none">
                          {t("open")}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </DataCard>
    </section>
  )
}
