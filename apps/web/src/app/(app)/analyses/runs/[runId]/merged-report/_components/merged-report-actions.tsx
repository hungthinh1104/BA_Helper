import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

interface MergedReportActionsProps {
  isStale: boolean
  canExport: boolean
  canFinalize: boolean
  isFinalizing: boolean
  exportingFormat: "md" | "pdf" | null
  onExport: (format: "md" | "pdf") => void
  onRefresh: () => void
}

export function MergedReportActions({
  isStale,
  canExport,
  canFinalize,
  isFinalizing,
  exportingFormat,
  onExport,
  onRefresh,
}: MergedReportActionsProps) {
  const t = useTranslations("multiRepo")

  return (
    <>
      <div className="ml-auto flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 shadow-none"
          onClick={() => onExport("md")}
          disabled={!canExport || exportingFormat !== null}
          title={isStale ? t("staleExportTitle") : undefined}
        >
          {exportingFormat === "md" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {t("exportMarkdown")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 shadow-none"
          onClick={() => onExport("pdf")}
          disabled={!canExport || exportingFormat !== null}
          title={isStale ? t("staleExportTitle") : undefined}
        >
          {exportingFormat === "pdf" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {t("exportPdf")}
        </Button>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-8 shadow-none"
        onClick={onRefresh}
        disabled={!canFinalize || isFinalizing}
      >
        {isFinalizing ? t("refreshing") : t("refreshSnapshot")}
      </Button>
    </>
  )
}
