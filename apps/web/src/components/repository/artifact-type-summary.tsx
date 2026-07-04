import { DenseCard } from "@/components/workspace/shared/dense-card"

interface ArtifactTypeSummaryProps {
  stats: { type: string; count: number }[]
}

export function ArtifactTypeSummary({ stats }: ArtifactTypeSummaryProps) {
  return (
    <div className="flex flex-col">
      <h3 className="text-sm font-semibold mb-4 text-foreground/80">Indexed Artifacts</h3>
      <div className="grid grid-cols-2 gap-4">
        {stats.map(stat => (
          <DenseCard key={stat.type} variant="muted" className="px-3 py-2">
            <span className="text-xl font-bold text-foreground">{stat.count}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">{stat.type}</span>
          </DenseCard>
        ))}
      </div>
    </div>
  )
}
