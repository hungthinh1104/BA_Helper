import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
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
    <Card className="h-full border-none shadow-none bg-surface/50">
      <CardHeader>
        <CardTitle className="text-lg">Extracted Business Graph</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Code2 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Entry Points (APIs)</h3>
          </div>
          <div className="flex flex-col gap-2">
            {preview.endpoints.map(endpoint => {
              const [method, path] = endpoint.split(' ')
              return (
                <div key={endpoint} className="flex items-center gap-2 p-2 rounded-md bg-surface border border-border">
                  <Badge variant="secondary" className="text-[10px] w-12 justify-center">{method}</Badge>
                  <span className="font-mono text-sm">{path}</span>
                </div>
              )
            })}
          </div>
        </div>
        
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Domain Entities</h3>
          </div>
          <div className="flex flex-col gap-2">
            {preview.entities.map(entity => (
              <div key={entity} className="flex items-center gap-2 p-2 rounded-md bg-surface border border-border">
                <span className="font-mono text-sm text-foreground">{entity}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
