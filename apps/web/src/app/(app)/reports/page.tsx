"use client"

import { WorkspacePageHeader } from "@/components/workspace/page-header"
import { DataList, DataListHeader, DataListRow, DataListCell } from "@/components/workspace/data-list"
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { CheckCircle2, AlertTriangle, Printer, X, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ReportViewer } from "@/components/report/report-viewer"
import { useState } from "react"
import { useAnalyses } from "@/hooks/api/use-analyses"
import { Skeleton } from "@/components/ui/skeleton"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"

function ReportsPageContent() {
  const gridCols = "minmax(200px, 2fr) minmax(130px, 1fr) minmax(130px, 1.2fr) minmax(150px, 1.5fr) 100px"
  
  const { data, isLoading, error } = useAnalyses()
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null)
  
  const analyses = data?.items || []
  const completedAnalyses = analyses.filter(a => a.status === "COMPLETED")

  const searchParams = useSearchParams()
  const router = useRouter()
  const urlAnalysisId = searchParams.get("analysisId")
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
        router.replace("/reports")
      }
    }
  }

  const selectedDoc = completedAnalyses.find((doc) => doc.id === activeAnalysisId)

  return (
      <div className="app-page-scroll">
        <div className="max-w-4xl mx-auto w-full py-4">
        <WorkspacePageHeader 
          title="Traceability Reports" 
          description="Generated evidence and matrix documents for final review and export."
        />

        <DataList>
          <DataListHeader gridCols={gridCols}>
            <DataListCell>Report Name</DataListCell>
            <DataListCell>Type</DataListCell>
            <DataListCell>Status</DataListCell>
            <DataListCell>Generated</DataListCell>
            <DataListCell className="text-right">Actions</DataListCell>
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
              <p className="text-[13px] font-medium text-foreground">Failed to load reports</p>
              <p className="text-[12px]">{error.message}</p>
            </div>
          )}

          {!isLoading && !error && completedAnalyses.length === 0 && (
            <div className="flex flex-col items-center text-center py-16 text-muted-foreground">
              <p className="text-[13px] font-medium text-foreground mb-1">No reports yet</p>
              <p className="text-[12px]">Finalize an impact analysis to generate a report.</p>
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
                        Impact Report
                      </span>
                    </DataListCell>
                    <DataListCell>
                      <DocumentStatusBadge status="APPROVED" isStale={doc.isStale} />
                    </DataListCell>
                    <DataListCell>
                      <span className="text-[12px] text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </DataListCell>
                    <DataListCell className="text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[12px] font-medium text-accent">View Report &rarr;</span>
                    </DataListCell>
                  </DataListRow>
                </div>
              } />
              <DialogContent className="sm:max-w-4xl h-[90vh] p-0 overflow-hidden flex flex-col bg-background/70 backdrop-blur-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.3)] ring-1 ring-white/10 dark:ring-white/5" showCloseButton={false}>
                <div className="flex flex-col h-full">
                  {/* Sticky Header inside Dialog */}
                  <div className="h-14 border-b border-border/60 bg-surface/50 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10 print:hidden">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm text-foreground line-clamp-1">
                        {selectedDoc?.requirementRevisionTitle ?? "Report View"}
                      </span>
                      {selectedDoc && <DocumentStatusPill status="APPROVED" isStale={selectedDoc.isStale} />}
                    </div>
                    <div className="flex items-center gap-4">
                      <Button size="sm" variant="outline" className="h-8 shadow-none gap-1.5 text-muted-foreground" onClick={() => window.print()}>
                        <Printer className="w-3.5 h-3.5" />
                        Print / Export
                      </Button>
                      <DialogClose className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors">
                        <X className="w-4 h-4" />
                      </DialogClose>
                    </div>
                  </div>
                  
                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto bg-surface/40">
                    {selectedDoc && (
                      <ReportViewer 
                        analysisId={selectedDoc.id}
                        commitSha={selectedDoc.snapshotCommitSha}
                        generatedAt={selectedDoc.createdAt}
                      />
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

function DocumentStatusBadge({ status, isStale }: { status: string; isStale: boolean }) {
  if (isStale) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-warning/10 text-warning border-warning/50 uppercase tracking-wider">
        <AlertTriangle className="w-3 h-3" /> Stale
      </span>
    )
  }
  if (status === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-success/10 text-success border-success/50 uppercase tracking-wider">
        <CheckCircle2 className="w-3 h-3" /> Approved
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-surface-muted text-muted-foreground border-border uppercase tracking-wider">
      Draft
    </span>
  )
}

function DocumentStatusPill({ status, isStale }: { status: string; isStale: boolean }) {
  if (isStale) {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-warning/10 text-warning border-warning/30 uppercase tracking-wider">
        <AlertTriangle className="w-3 h-3" /> Stale
      </span>
    )
  }
  if (status === "APPROVED") {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-success/10 text-success border-success/30 uppercase tracking-wider">
        <CheckCircle2 className="w-3 h-3" /> Approved
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-surface-muted text-muted-foreground border-border uppercase tracking-wider">
      Draft
    </span>
  )
}
