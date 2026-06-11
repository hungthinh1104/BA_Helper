import { Badge } from "@/components/ui/badge"
import { RepositoryCreateResponse, ScanJobResponse } from "@ba-helper/contracts"
import { FolderGit2 } from "lucide-react"

interface SnapshotHeaderProps {
  repository: RepositoryCreateResponse
  scanJob: ScanJobResponse
}

export function SnapshotHeader({ repository, scanJob }: SnapshotHeaderProps) {
  const isReady = scanJob.result.snapshotCoverageStatus === "READY"
  
  return (
    <div className="flex items-start justify-between border-b border-border pb-6 mb-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <FolderGit2 className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold m-0">{repository.canonicalUrl.split('/').pop()}</h1>
          {isReady ? (
            <Badge className="bg-success text-white hover:bg-success/90">Index Ready</Badge>
          ) : (
            <Badge variant="outline" className="text-warning border-warning/30">Partial/Indexing</Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <span>{repository.canonicalUrl}</span>
          <span>•</span>
          <span>Target: <strong className="text-foreground">main</strong></span>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground mb-1">Snapshot ID</p>
        <p className="font-mono text-xs">{scanJob.result.snapshotId?.split('-')[0]}...</p>
      </div>
    </div>
  )
}
