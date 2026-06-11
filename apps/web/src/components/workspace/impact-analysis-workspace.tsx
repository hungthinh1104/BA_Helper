import { ReactNode } from "react"
import { EvidenceInspector } from "./evidence-inspector"
import { MousePointerClick } from "lucide-react"

interface ImpactAnalysisWorkspaceProps {
  children: ReactNode
  inspectorTitle?: string
  inspectorSubtitle?: string
  inspectorCategory?: string
  inspectorCertaintyBadge?: ReactNode
  inspectorContent?: ReactNode
  inspectorFooter?: ReactNode
}

export function ImpactAnalysisWorkspace({ 
  children, 
  inspectorTitle = "Select an item to view evidence", 
  inspectorSubtitle,
  inspectorCategory,
  inspectorCertaintyBadge,
  inspectorContent,
  inspectorFooter,
}: ImpactAnalysisWorkspaceProps) {
  return (
    <div className="app-workspace">
      <div className="app-content h-full overflow-y-auto">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </div>
      
      {inspectorContent ? (
        <EvidenceInspector
          title={inspectorTitle}
          subtitle={inspectorSubtitle}
          category={inspectorCategory}
          certaintyBadge={inspectorCertaintyBadge}
          footer={inspectorFooter}
        >
          {inspectorContent}
        </EvidenceInspector>
      ) : (
        <aside className="app-inspector flex flex-col items-center justify-center h-full">
          <div
            className="flex flex-col items-center text-center px-8"
            style={{
              backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
              borderRadius: "12px",
              padding: "40px 32px",
            }}
          >
            <div className="w-12 h-12 rounded-xl bg-surface border border-border/60 flex items-center justify-center mb-4 shadow-sm">
              <MousePointerClick className="w-5 h-5 text-muted-foreground/60" />
            </div>
            <p className="text-[13px] font-medium text-foreground mb-1.5">No insight selected</p>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              Click any item in the list<br />on the left to view its evidence
            </p>
          </div>
        </aside>
      )}
    </div>
  )
}
