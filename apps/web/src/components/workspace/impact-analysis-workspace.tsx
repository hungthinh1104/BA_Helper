import { ReactNode } from "react"
import { EvidenceInspector } from "./evidence-inspector"

interface ImpactAnalysisWorkspaceProps {
  children: ReactNode
  inspectorTitle?: string
  inspectorSubtitle?: string
  inspectorContent?: ReactNode
}

export function ImpactAnalysisWorkspace({ 
  children, 
  inspectorTitle = "Select an item to view evidence", 
  inspectorSubtitle, 
  inspectorContent 
}: ImpactAnalysisWorkspaceProps) {
  return (
    <div className="app-workspace">
      <div className="app-content h-full overflow-y-auto">
        <div className="analysis-header">
          <div>
            <h1 className="analysis-title">Cancel Booking & Refund</h1>
            <p className="analysis-subtitle">Requirement Revision: rev-abc1234</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-neutral">DRAFT</span>
          </div>
        </div>
        
        <div className="max-w-4xl">
          {children}
        </div>
      </div>
      
      {inspectorContent ? (
        <EvidenceInspector title={inspectorTitle} subtitle={inspectorSubtitle}>
          {inspectorContent}
        </EvidenceInspector>
      ) : (
        <aside className="app-inspector flex items-center justify-center text-muted-foreground text-sm h-full">
          Select an insight to view evidence
        </aside>
      )}
    </div>
  )
}
