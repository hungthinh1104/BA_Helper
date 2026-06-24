import { ReactNode } from "react"
import { EvidenceInspector } from "@/components/workspace/analysis/retrieval/evidence-inspector"
import { MousePointerClick } from "lucide-react"
import { Group, Panel, Separator } from "react-resizable-panels"
import { useMediaQuery } from "@/hooks/ui/use-media-query"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

interface ImpactAnalysisWorkspaceProps {
  children: ReactNode
  inspectorTitle?: string
  inspectorSubtitle?: string
  inspectorCategory?: string
  inspectorCertaintyBadge?: ReactNode
  inspectorContent?: ReactNode
  inspectorFooter?: ReactNode
  onCloseInspector?: () => void
}

export function ImpactAnalysisWorkspace({ 
  children, 
  inspectorTitle = "Select an item to inspect evidence", 
  inspectorSubtitle,
  inspectorCategory,
  inspectorCertaintyBadge,
  inspectorContent,
  inspectorFooter,
  onCloseInspector,
}: ImpactAnalysisWorkspaceProps) {
  const isDesktop = useMediaQuery("(min-width: 1100px)")
  const hasContent = Boolean(inspectorContent)

  const inspectorNode = inspectorContent ? (
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
      <div className="flex w-full max-w-sm flex-col items-center rounded-2xl border border-dashed border-border/60 bg-surface-muted/20 px-8 py-10 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-surface shadow-sm">
          <MousePointerClick className="w-5 h-5 text-muted-foreground/60" />
        </div>
        <p className="mb-1.5 text-sm font-medium text-foreground">Nothing selected yet</p>
        <p className="text-sm leading-6 text-muted-foreground">
          Select evidence, insight, link, or graph node to inspect supporting context and review actions.
        </p>
      </div>
    </aside>
  )

  if (!isDesktop) {
    return (
      <div className="h-full w-full flex flex-col relative bg-background">
        {children}

        <Sheet open={hasContent} onOpenChange={(open) => {
          if (!open && onCloseInspector) onCloseInspector()
        }}>
          <SheetContent side="bottom" className="h-[85dvh] border-t p-0 pb-[env(safe-area-inset-bottom)]">
            <SheetTitle className="sr-only">Inspector</SheetTitle>
            {inspectorNode}
          </SheetContent>
        </Sheet>
      </div>
    )
  }

  return (
    <Group orientation="horizontal" id="workspace-panels" className="h-full w-full">
      <Panel className="h-full flex flex-col min-h-0 relative bg-background">
        {children}
      </Panel>
      
      <Separator className="w-4 shrink-0 cursor-col-resize items-center justify-center outline-none hover:bg-transparent flex">
        <div className="h-10 w-1.5 rounded-full bg-border/40 group-hover:bg-accent/60 group-active:bg-accent transition-colors" />
      </Separator>
      
      <Panel defaultSize="420px" minSize="300px" maxSize="800px" collapsible={true} collapsedSize="0px" className="h-full border-l border-border bg-inspector-bg">
        {inspectorNode}
      </Panel>
    </Group>
  )
}
