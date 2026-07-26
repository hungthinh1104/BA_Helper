import { useState } from "react"
import { useLatestReviewedReportSnapshot } from "@/hooks/api/use-documents"
import { Button } from "@/components/ui/button"
import { Lock, Loader2, FileText } from "lucide-react"
import { LockedSnapshotViewer } from "./locked-snapshot-viewer"
import { useLocale, useTranslations } from "next-intl"

export function ReviewedSnapshotPanel({ analysisId }: { analysisId: string }) {
  const t = useTranslations("reports")
  const locale = useLocale()
  const { data: snapshot, isLoading: isLoadingSnapshot } = useLatestReviewedReportSnapshot(analysisId)
  
  const [viewerOpen, setViewerOpen] = useState(false)

  if (isLoadingSnapshot) {
    return (
      <div className="mt-12 p-6 border-t border-border/50 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    )
  }

  const hasSnapshot = !!snapshot

  return (
    <div className="mt-12 pt-8 border-t border-border/50 print:hidden">
      <div className="rounded-lg border border-border/50 bg-surface overflow-hidden">
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-md shrink-0 ${hasSnapshot ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
              {hasSnapshot ? <Lock className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold text-sm tracking-tight text-foreground">
                {hasSnapshot ? t("reviewedSnapshotLocked") : t("reviewedReportSnapshot")}
              </h3>
              <p className="text-[13px] text-muted-foreground max-w-md">
                {hasSnapshot 
                  ? t("snapshotCapturedAt", { date: new Date(snapshot.createdAt).toLocaleString(locale) })
                  : t("noReviewedSnapshot")}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            {hasSnapshot ? (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 font-medium text-[13px]"
                onClick={() => setViewerOpen(true)}
              >
                {t("viewLockedSnapshot")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {snapshot && (
        <LockedSnapshotViewer 
          snapshot={snapshot} 
          open={viewerOpen} 
          onOpenChange={setViewerOpen} 
        />
      )}
    </div>
  )
}
