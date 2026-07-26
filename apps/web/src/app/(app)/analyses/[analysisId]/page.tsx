"use client"

import { use } from "react"
import { notFound } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { AnalysisWorkspaceShell } from "@/components/workspace/analysis/analysis-workspace-shell"
import { useAnalysisWorkspace } from "@/hooks/api/use-analyses"
import { DEFAULT_ANALYSIS_WORKSPACE_LOCALE, type SupportedLocale } from "@/lib/i18n/status-labels"
import { normalizeAppLocale } from "@/i18n/app-locale"

export default function ImpactAnalysisDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ analysisId: string }>
  searchParams: Promise<{ locale?: string | string[] }>
}) {
  const { analysisId } = use(params)
  const query = use(searchParams)
  const candidateLocale = Array.isArray(query.locale) ? query.locale[0] : query.locale
  const locale: SupportedLocale = normalizeAppLocale(candidateLocale ?? DEFAULT_ANALYSIS_WORKSPACE_LOCALE)
  const {
    data: workspace,
    isLoading,
    error,
  } = useAnalysisWorkspace(analysisId)

  if (isLoading) {
    return (
      <div className="app-page-scroll flex min-h-0 flex-col gap-4 p-4 md:p-6">
        <Skeleton className="h-8 w-[320px]" />
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-[360px] w-full" />
      </div>
    )
  }

  if (error || !workspace) {
    if (error && (error as { status?: number }).status === 404) notFound()
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center text-center text-muted-foreground">
        <AlertCircle className="mb-4 h-8 w-8 text-destructive" />
        <p className="text-sm font-medium text-foreground">Failed to load analysis workspace</p>
        <p className="mt-1 text-xs">
          {error instanceof Error ? error.message : "Analysis workspace is unavailable."}
        </p>
      </div>
    )
  }

  return <AnalysisWorkspaceShell workspace={workspace} locale={locale} />
}
