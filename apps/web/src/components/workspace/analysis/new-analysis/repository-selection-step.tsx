import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConnectRepoDialog } from "@/components/workspace/repository/connect-repo-dialog"
import { RepositorySelectionStepProps } from "./new-analysis-types"

export function RepositorySelectionStep({
  reposLoading,
  reposError,
  readyRepos,
  selectedRepos,
  toggleRepository,
  hasPreselectedReq,
  handleBack,
  handleNext,
}: RepositorySelectionStepProps) {
  return (
    <div className="flex flex-col">
      <div className="px-6 py-4 flex flex-col gap-2 max-h-72 overflow-y-auto">
        {reposLoading ? (
          <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-[13px]">Loading repositories...</span>
          </div>
        ) : reposError ? (
          <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
            <AlertCircle className="w-5 h-5 text-danger" />
            <span className="text-[13px]">Failed to load repositories.</span>
          </div>
        ) : readyRepos.length === 0 ? (
          <div className="py-8 flex flex-col items-center gap-3 text-center text-[13px] text-muted-foreground">
            <p>No indexed repositories. Connect a repository and wait for the scan to complete.</p>
            <ConnectRepoDialog>
              <Button size="sm" variant="outline" className="shadow-none">Connect Repository</Button>
            </ConnectRepoDialog>
          </div>
        ) : (
          readyRepos.map((repo) => {
            const coverage = repo.latestSnapshot?.coverageStatus
            const selected = selectedRepos.some((item) => item.id === repo.id)
            return (
              <button
                key={repo.id}
                onClick={() => toggleRepository(repo)}
                className={`text-left p-3.5 rounded-lg border transition-all ${
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border/60 bg-surface hover:bg-surface-soft hover:border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-sm border flex items-center justify-center ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background"
                      }`}
                    >
                      {selected ? <CheckCircle2 className="w-3 h-3" /> : null}
                    </div>
                    <p className="text-[13px] font-mono font-medium text-foreground">{repo.displayName}</p>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase border ${
                      coverage === "READY"
                        ? "bg-success/10 text-success border-success/50"
                        : "bg-warning/10 text-warning border-warning/50"
                    }`}
                  >
                    {coverage}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground/70 font-mono">
                  {repo.canonicalUrl.replace("https://github.com/", "")} · {repo.latestTarget?.requestedRef}
                </p>
              </button>
            )
          })
        )}
      </div>
      <div className="px-6 py-4 border-t border-border/60 bg-surface-muted/30 flex justify-between gap-2">
        {!hasPreselectedReq && (
          <Button variant="outline" size="sm" className="h-8 shadow-none" onClick={handleBack}>
            ← Back
          </Button>
        )}
        <div className={`flex items-center gap-3 ${hasPreselectedReq ? "w-full justify-between" : ""}`}>
          <span className="text-[11px] text-muted-foreground">
            {selectedRepos.length} repository{selectedRepos.length === 1 ? "" : "ies"} selected
          </span>
          <Button
            size="sm"
            className="h-8 shadow-none"
            disabled={selectedRepos.length === 0}
            onClick={handleNext}
          >
            Next →
          </Button>
        </div>
      </div>
    </div>
  )
}
