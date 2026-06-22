import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"

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
  return (
    <>
      <div className="ml-auto flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 shadow-none"
          onClick={() => onExport("md")}
          disabled={!canExport || exportingFormat !== null}
          title={isStale ? "Merged report is stale; refresh the snapshot before export." : undefined}
        >
          {exportingFormat === "md" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Export Markdown
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 shadow-none"
          onClick={() => onExport("pdf")}
          disabled={!canExport || exportingFormat !== null}
          title={isStale ? "Merged report is stale; refresh the snapshot before export." : undefined}
        >
          {exportingFormat === "pdf" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Export PDF
        </Button>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-8 shadow-none"
        onClick={onRefresh}
        disabled={!canFinalize || isFinalizing}
      >
        {isFinalizing ? "Refreshing..." : "Refresh snapshot"}
      </Button>
    </>
  )
}
