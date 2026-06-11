import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ImpactAnalysisResponse } from "@ba-helper/contracts"

interface AnalysisHeaderProps {
  analysis: ImpactAnalysisResponse
}

export function AnalysisHeader({ analysis }: AnalysisHeaderProps) {
  return (
    <div className="analysis-header border-b border-border pb-6 mb-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="analysis-title m-0">{analysis.requirement.revisionTitle}</h1>
          <Badge variant="outline" className="badge-neutral text-xs">{analysis.status}</Badge>
        </div>
        <p className="analysis-subtitle text-sm m-0">
          Commit: <span className="mono">{analysis.snapshot.commitSha.substring(0, 7)}</span> • 
          Target: <span className="mono">{analysis.sourceTarget.requestedRef}</span>
        </p>
      </div>
      
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={!analysis.capabilities.canExport}>Export Report</Button>
        <Button size="sm" disabled={!analysis.capabilities.canFinalize}>Finalize Analysis</Button>
      </div>
    </div>
  )
}
