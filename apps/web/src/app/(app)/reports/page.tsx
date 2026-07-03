"use client"

import { WorkspacePageHeader } from "@/components/workspace/shared/page-header"
import { DataList, DataListHeader, DataListRow, DataListCell } from "@/components/workspace/shared/data-list"
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { AlertTriangle, X, AlertCircle } from "lucide-react"
import { ReportViewer } from "@/components/report/report-viewer"
import { useState } from "react"
import { useAnalyses } from "@/hooks/api/use-analyses"
import { Skeleton } from "@/components/ui/skeleton"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import { AnalysisStatusBadge } from "@/components/workspace/shared/status-badges"
import { normalizeAppLocale } from "@/i18n/app-locale"
import { useTranslations } from "next-intl"

function ReportsPageContent() {
  const t = useTranslations("reports")
  const gridCols = "minmax(200px, 2fr) minmax(130px, 1fr) minmax(130px, 1.2fr) minmax(150px, 1.5fr) 100px"
  
  const { data, isLoading, error } = useAnalyses()
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null)
  
  const analyses = data?.items || []
  const completedAnalyses = analyses.filter(a => a.status === "COMPLETED")

  const searchParams = useSearchParams()
  const router = useRouter()
  const urlAnalysisId = searchParams?.get("analysisId")
  const urlLocale = normalizeAppLocale(searchParams?.get("locale"))
  const activeAnalysisId =
    urlAnalysisId && completedAnalyses.some((analysis) => analysis.id === urlAnalysisId)
      ? urlAnalysisId
      : selectedAnalysisId

  const handleOpenChange = (docId: string, open: boolean) => {
    if (open) {
      setSelectedAnalysisId(docId)
    } else {
      setSelectedAnalysisId(null)
      if (urlAnalysisId === docId || urlAnalysisId) {
        router.replace(urlLocale === "en" ? "/reports" : `/reports?locale=${urlLocale}`)
      }
    }
  }

  const selectedDoc = completedAnalyses.find((doc) => doc.id === activeAnalysisId)

  return (
      <div className="app-page-scroll">
        <div className="max-w-4xl mx-auto w-full py-4">
        <WorkspacePageHeader 
          title={t("pageTitle")}
          description={t("pageDescription")}
        />

        {urlAnalysisId && !completedAnalyses.some(a => a.id === urlAnalysisId) && !isLoading && (
          <div className="mb-6 flex items-start gap-3 p-4 bg-warning/10 border border-warning/20 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <h3 className="text-[13px] font-semibold text-warning">{t("reportUnavailable")}</h3>
              <p className="text-[12px] text-warning/80">
                {t("reportUnavailableDescription")}
              </p>
            </div>
          </div>
        )}

        <DataList>
          <DataListHeader gridCols={gridCols}>
            <DataListCell>{t("requirement")}</DataListCell>
            <DataListCell>{t("type")}</DataListCell>
            <DataListCell>{t("status")}</DataListCell>
            <DataListCell>{t("analyzedOn")}</DataListCell>
            <DataListCell className="text-right">{t("actions")}</DataListCell>
          </DataListHeader>
          
          {isLoading && (
            <>
              {[1, 2, 3].map((i) => (
                <DataListRow key={i} gridCols={gridCols}>
                  <DataListCell><Skeleton className="h-4 w-[180px]" /></DataListCell>
                  <DataListCell><Skeleton className="h-4 w-[100px]" /></DataListCell>
                  <DataListCell><Skeleton className="h-5 w-[80px] rounded-md" /></DataListCell>
                  <DataListCell><Skeleton className="h-4 w-[60px]" /></DataListCell>
                  <DataListCell className="justify-end"><Skeleton className="h-4 w-[80px]" /></DataListCell>
                </DataListRow>
              ))}
            </>
          )}

          {error && (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <AlertCircle className="w-6 h-6 text-destructive mb-4" />
              <p className="text-[13px] font-medium text-foreground">{t("failedToLoad")}</p>
              <p className="text-[12px]">{error.message}</p>
            </div>
          )}

          {!isLoading && !error && completedAnalyses.length === 0 && (
            <div className="flex flex-col items-center text-center py-16 text-muted-foreground">
              <p className="text-[13px] font-medium text-foreground mb-1">{t("noReports")}</p>
              <p className="text-[12px]">{t("noReportsDescription")}</p>
            </div>
          )}
          
          {completedAnalyses.map((doc) => (
            <Dialog key={doc.id} open={activeAnalysisId === doc.id} onOpenChange={(open) => handleOpenChange(doc.id, open)}>
              <DialogTrigger nativeButton={false} render={
                <div className="cursor-pointer group">
                  <DataListRow gridCols={gridCols}>
                    <DataListCell>
                      <div className="font-medium text-[13px] text-foreground">
                        {doc.requirementRevisionTitle}
                      </div>
                      <div className="text-muted-foreground text-[11px] mt-0.5 font-mono">
                        {doc.snapshotCommitSha.substring(0, 7)}
                      </div>
                    </DataListCell>
                    <DataListCell>
                      <span className="px-2 py-0.5 bg-surface-muted text-muted-foreground border border-border rounded-md text-[10px] font-medium tracking-wide uppercase">
                        {t("impactReport")}
                      </span>
                    </DataListCell>
                    <DataListCell>
                      <AnalysisStatusBadge status={doc.isStale ? "STALE" : "COMPLETED"} />
                    </DataListCell>
                    <DataListCell>
                      <span className="text-[12px] text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </DataListCell>
                    <DataListCell className="text-right lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      <span className="text-[12px] font-medium text-accent">{t("viewReport")}</span>
                    </DataListCell>
                  </DataListRow>
                </div>
              } />
              <DialogContent className="sm:max-w-4xl h-[90vh] p-0 overflow-hidden flex flex-col bg-background shadow-[0_8px_40px_-12px_rgba(0,0,0,0.3)]" showCloseButton={false}>
                <div className="flex flex-col h-full">
                  {/* Sticky Header inside Dialog */}
                  <div className="h-14 border-b border-border/60 bg-surface flex items-center justify-between px-6 shrink-0 z-10 print:hidden">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm text-foreground line-clamp-1">
                        {selectedDoc?.requirementRevisionTitle ?? t("reportView")}
                      </span>
                      {selectedDoc && (
                        <AnalysisStatusBadge status={selectedDoc.isStale ? "STALE" : "COMPLETED"} />
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <DialogClose
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                        aria-label="Close report preview"
                      >
                        <X className="size-4" />
                      </DialogClose>
                    </div>
                  </div>
                  
                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto bg-background">
                    {selectedDoc && (
                      <ReportViewer analysisId={selectedDoc.id} locale={urlLocale} />
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </DataList>
        </div>
      </div>
    )
}

export default function ReportsPage() {
  return (
    <Suspense fallback={
      <div className="p-8 flex justify-center"><Skeleton className="h-10 w-48" /></div>
    }>
      <ReportsPageContent />
    </Suspense>
  )
}
