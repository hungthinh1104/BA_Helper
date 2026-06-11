"use client"

import { AppShell } from "@/components/layout/app-shell"
import { SnapshotHeader } from "@/components/repository/snapshot-header"
import { ScanJobTimeline } from "@/components/repository/scan-job-timeline"
import { ArtifactTypeSummary } from "@/components/repository/artifact-type-summary"
import { RepositoryGraphPreview } from "@/components/repository/repository-graph-preview"
import { 
  MOCK_REPOSITORY, 
  MOCK_SCAN_JOB, 
  MOCK_ARTIFACT_STATS, 
  MOCK_GRAPH_PREVIEW 
} from "@/lib/mock-data/repository-snapshot"

export default function RepositorySnapshotPage() {
  return (
    <AppShell>
      <div className="p-8 max-w-6xl mx-auto h-full flex flex-col">
        <SnapshotHeader repository={MOCK_REPOSITORY} scanJob={MOCK_SCAN_JOB} />
        
        <div className="grid grid-cols-3 gap-8 flex-1 min-h-0">
          <div className="col-span-2 overflow-y-auto pr-4">
            <RepositoryGraphPreview preview={MOCK_GRAPH_PREVIEW} />
          </div>
          
          <div className="col-span-1 flex flex-col gap-6 overflow-y-auto pl-4 border-l border-border">
            <ScanJobTimeline scanJob={MOCK_SCAN_JOB} />
            <ArtifactTypeSummary stats={MOCK_ARTIFACT_STATS} />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
