import { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"

interface EvidenceInspectorProps {
  title: string
  subtitle?: string
  children: ReactNode
}

export function EvidenceInspector({ title, subtitle, children }: EvidenceInspectorProps) {
  return (
    <aside className="app-inspector flex flex-col h-full">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="badge-evidence border-info/30">Evidence</Badge>
        </div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </aside>
  )
}
