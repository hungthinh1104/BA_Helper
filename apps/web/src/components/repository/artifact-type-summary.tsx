import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

interface ArtifactTypeSummaryProps {
  stats: { type: string; count: number }[]
}

export function ArtifactTypeSummary({ stats }: ArtifactTypeSummaryProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Indexed Artifacts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {stats.map(stat => (
            <div key={stat.type} className="flex flex-col">
              <span className="text-2xl font-bold text-foreground">{stat.count}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{stat.type}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
