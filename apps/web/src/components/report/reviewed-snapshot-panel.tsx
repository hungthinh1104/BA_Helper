import { useState } from "react"
import { useLatestReviewedReportSnapshot, useCreateReviewedReportSnapshot } from "@/hooks/api/use-reviewed-report-snapshot"
import { Button } from "@/components/ui/button"
import { Lock, Loader2, CheckCircle, FileText } from "lucide-react"
import { LockedSnapshotViewer } from "./locked-snapshot-viewer"
import { toast } from "sonner"

export function ReviewedSnapshotPanel({ analysisId }: { analysisId: string }) {
  const { data: snapshot, isLoading: isLoadingSnapshot, isError } = useLatestReviewedReportSnapshot(analysisId)
  const createMutation = useCreateReviewedReportSnapshot(analysisId)
  
  const [viewerOpen, setViewerOpen] = useState(false)

  const handleCreateSnapshot = async () => {
    try {
      await createMutation.mutateAsync()
      toast.success("Reviewed snapshot created successfully.")
    } catch (error) {
      toast.error("Failed to create snapshot", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  if (isLoadingSnapshot) {
    return (
      <div className="mt-12 p-6 border-t border-border/50 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    )
  }

  const hasSnapshot = !!snapshot

  return (
    <div className="mt-12 pt-8 border-t border-border/50 print:hidden">
      <div className="rounded-lg border border-border/50 bg-surface overflow-hidden">
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-md shrink-0 ${hasSnapshot ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
              {hasSnapshot ? <Lock className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold text-sm tracking-tight text-foreground">
                {hasSnapshot ? "Reviewed Snapshot Locked" : "Reviewed Report Snapshot"}
              </h3>
              <p className="text-[13px] text-muted-foreground max-w-md">
                {hasSnapshot 
                  ? `An audited snapshot of this report and its review decisions was captured on ${new Date(snapshot.createdAt).toLocaleString()}.`
                  : "Create an immutable snapshot of this report and all current review decisions for audit trails."}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            {hasSnapshot ? (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 font-medium text-[13px]"
                onClick={() => setViewerOpen(true)}
              >
                View Locked Snapshot
              </Button>
            ) : null}
            
            <Button 
              variant={hasSnapshot ? "outline" : "default"}
              size="sm"
              className={`h-9 font-medium text-[13px] ${!hasSnapshot ? 'bg-foreground text-background hover:bg-foreground/90' : ''}`}
              onClick={handleCreateSnapshot}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : hasSnapshot ? (
                <CheckCircle className="w-4 h-4 mr-2 text-success" />
              ) : (
                <Lock className="w-4 h-4 mr-2" />
              )}
              {hasSnapshot ? "Update Snapshot" : "Create Reviewed Snapshot"}
            </Button>
          </div>
        </div>
      </div>

      {snapshot && (
        <LockedSnapshotViewer 
          snapshot={snapshot} 
          open={viewerOpen} 
          onOpenChange={setViewerOpen} 
        />
      )}
    </div>
  )
}
