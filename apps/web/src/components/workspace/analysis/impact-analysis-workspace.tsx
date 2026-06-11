import { ReactNode } from "react"
import { EvidenceInspector } from "@/components/workspace/shared/retrieval/evidence-inspector"
import { MousePointerClick } from "lucide-react"
import { Group, Panel, Separator } from "react-resizable-panels"

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
    <Group orientation="horizontal" id="workspace-panels" className="h-full w-full">
      <Panel className="h-full flex flex-col min-h-0 relative bg-background">
        {children}
      </Panel>
      
      <Separator className="w-4 flex items-center justify-center cursor-col-resize shrink-0 group outline-none hover:bg-transparent">
        <div className="h-10 w-1.5 rounded-full bg-border/40 group-hover:bg-accent/60 group-active:bg-accent transition-colors" />
      </Separator>
      
      <Panel defaultSize="360px" minSize="260px" maxSize="800px" collapsible={true} collapsedSize="0px" className="h-full border-l border-border bg-inspector-bg">
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
          <aside className="flex flex-col items-center justify-center h-full p-4">
            <div
              className="flex flex-col items-center text-center px-8 w-full max-w-sm"
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
                Click any item in the list<br />to view its evidence
              </p>
            </div>
          </aside>
        )}
      </Panel>
    </Group>
  )
}
