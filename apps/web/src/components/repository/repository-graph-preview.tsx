import { Badge } from "@/components/ui/badge"
import { Code2, Database } from "lucide-react"

interface RepositoryGraphPreviewProps {
  preview: {
    endpoints: string[]
    entities: string[]
  }
}

export function RepositoryGraphPreview({ preview }: RepositoryGraphPreviewProps) {
  return (
    <div className="h-full flex flex-col">
      <h2 className="text-lg font-bold mb-6">Extracted Business Graph</h2>
      
      <div className="grid grid-cols-2 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border/50">
            <Code2 className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Entry Points (APIs)</h3>
          </div>
          <div className="flex flex-col gap-0.5">
            {preview.endpoints.map(endpoint => {
              const [method, path] = endpoint.split(' ')
              return (
                <div key={endpoint} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-surface-soft transition-colors group">
                  <Badge variant="secondary" className="text-[9px] w-12 justify-center py-0 h-4 bg-surface-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">{method}</Badge>
                  <span className="font-mono text-[12px] text-foreground/80 group-hover:text-foreground transition-colors">{path}</span>
                </div>
              )
            })}
          </div>
        </div>
        
        <div>
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border/50">
            <Database className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Domain Entities</h3>
          </div>
          <div className="flex flex-col gap-0.5">
            {preview.entities.map(entity => (
              <div key={entity} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-surface-soft transition-colors group">
                <div className="w-1.5 h-1.5 rounded-full bg-border group-hover:bg-primary transition-colors"></div>
                <span className="font-mono text-[12px] text-foreground/80 group-hover:text-foreground transition-colors">{entity}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
