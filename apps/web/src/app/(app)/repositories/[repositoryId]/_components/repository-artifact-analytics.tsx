import { Layers, Server, Box, Database, Beaker } from "lucide-react"

interface ArtifactStatCardProps {
  label: string
  count: number
  icon: React.ReactNode
}

function ArtifactStatCard({ label, count, icon }: ArtifactStatCardProps) {
  return (
    <div className="flex flex-col p-4 rounded-xl border border-border/40 bg-surface/40 backdrop-blur-md shadow-sm transition-colors hover:bg-surface-soft/60">
      <div className="flex items-center justify-between mb-3">
        <div className="text-muted-foreground [&>svg]:w-4 [&>svg]:h-4">
          {icon}
        </div>
        <span className="text-xl font-bold text-foreground">{count}</span>
      </div>
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
    </div>
  )
}

interface RepositoryArtifactAnalyticsProps {
  stats: {
    controllers: number
    services: number
    entities: number
    tests: number
  } | undefined | null
}

export function RepositoryArtifactAnalytics({ stats }: RepositoryArtifactAnalyticsProps) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
        <Layers className="w-4 h-4 text-muted-foreground" />
        Artifact Analytics
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ArtifactStatCard icon={<Server />} label="Controllers" count={stats?.controllers || 0} />
        <ArtifactStatCard icon={<Box />} label="Services" count={stats?.services || 0} />
        <ArtifactStatCard icon={<Database />} label="Entities" count={stats?.entities || 0} />
        <ArtifactStatCard icon={<Beaker />} label="Tests" count={stats?.tests || 0} />
      </div>
    </div>
  )
}
