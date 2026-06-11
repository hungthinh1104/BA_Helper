import { FileText } from "lucide-react"
import { MatrixRowArtifactDetail } from "@ba-helper/contracts"

interface MatrixDiagnosticsPanelProps {
  artifacts: MatrixRowArtifactDetail[]
}

export function MatrixDiagnosticsPanel({ artifacts }: MatrixDiagnosticsPanelProps) {
  if (artifacts.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        No diagnostics available.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {artifacts.map((artifact) => {
        const diag = artifact.retrievalDiagnostics as Record<string, unknown> | undefined
        if (!diag) return null

        return (
          <div key={artifact.artifactId} className="rounded-lg border bg-surface p-4">
            <h4 className="text-[13px] font-medium mb-3 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              {artifact.displayName}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(diag)
                .filter(([, v]) => typeof v === "number" || typeof v === "string")
                .map(([k, v]) => (
                  <div key={k} className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                      {k}
                    </span>
                    <span className="text-[12px] font-mono font-medium">
                      {typeof v === "number" ? v.toFixed(3) : String(v)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
