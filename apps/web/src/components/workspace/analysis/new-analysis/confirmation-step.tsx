import { CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmationStepProps } from "./new-analysis-types"

function SummaryRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 px-4 py-2.5">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider self-center">
        {label}
      </span>
      <span className={`text-[12px] text-foreground/90 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  )
}

export function ConfirmationStep({
  selectedReq,
  preselectedReqRevisionId,
  selectedRepos,
  oldAnalysisSnapshotCommit,
  hasPartialRepo,
  acknowledgePartial,
  setAcknowledgePartial,
  batchSuccess,
  batchError,
  canProceed,
  loading,
  isAdmin,
  handleBack,
  handleSubmit,
  handleOpenRun,
}: ConfirmationStepProps) {
  const selectedRepo = selectedRepos.length === 1 ? selectedRepos[0] : null

  if (batchSuccess) {
    return (
      <div className="flex flex-col">
        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-lg border border-success/25 bg-success/8 px-4 py-3">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-medium text-foreground">
                Created {batchSuccess.items.length} analyses successfully
              </p>
              <p className="text-[12px] text-muted-foreground mt-1">
                Each selected repository received its own analysis inside one multi-repo run. Open the run to review progress.
              </p>
            </div>
          </div>
          <div className="flex flex-col divide-y divide-border/60 border border-border/60 rounded-lg overflow-hidden bg-surface-muted/30">
            {batchSuccess.items.map((item) => (
              <div key={item.analysisId} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">
                    {item.repositoryDisplayName}
                  </p>
                  <p className="text-[11px] font-mono text-muted-foreground truncate">
                    {item.analysisId}
                  </p>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase border bg-primary/10 text-primary border-primary/30 self-start">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border/60 bg-surface-muted/30 flex justify-end">
          <Button size="sm" className="h-8 shadow-none" onClick={handleOpenRun}>
            Open Run
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="px-6 py-5 flex flex-col gap-4">
        <div className="flex flex-col divide-y divide-border/60 border border-border/60 rounded-lg overflow-hidden bg-surface-muted/30">
          <SummaryRow label="Requirement" value={selectedReq.latestRevision.title} mono={false} />
          <SummaryRow
            label="Revision ID"
            value={preselectedReqRevisionId ?? selectedReq.latestRevision.id}
          />
          <SummaryRow
            label={selectedRepos.length === 1 ? "Repository" : "Repositories"}
            value={
              selectedRepos.length === 1
                ? selectedRepos[0].displayName
                : `${selectedRepos.length} selected`
            }
            mono={false}
          />
          {selectedRepos.length === 1 ? (
            <>
              <SummaryRow label="Snapshot" value={selectedRepos[0].latestSnapshot?.id ?? "—"} />
              <SummaryRow label="Commit" value={selectedRepos[0].latestSnapshot?.commitSha ?? "—"} />
              <SummaryRow
                label="Coverage"
                value={selectedRepos[0].latestSnapshot?.coverageStatus ?? "—"}
              />
            </>
          ) : (
            <div className="px-4 py-3">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Selected repositories
              </span>
              <div className="mt-2 flex flex-col gap-2">
                {selectedRepos.map((repo) => (
                  <div key={repo.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] text-foreground">{repo.displayName}</p>
                      <p className="text-[11px] font-mono text-muted-foreground truncate">
                        {repo.latestSnapshot?.commitSha ?? "—"}
                      </p>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase border bg-surface text-muted-foreground border-border">
                      {repo.latestSnapshot?.coverageStatus ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {oldAnalysisSnapshotCommit &&
            selectedRepo?.latestSnapshot?.commitSha !== oldAnalysisSnapshotCommit && (
              <div className="px-4 py-3 flex gap-2 items-start bg-blue-500/10 text-blue-500/90 text-[12px] leading-snug">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  This analysis will use a newer repository snapshot (
                  <strong>{selectedRepo?.latestSnapshot?.commitSha.slice(0, 7)}</strong>) than the original
                  analysis (<strong>{oldAnalysisSnapshotCommit.slice(0, 7)}</strong>).
                </p>
              </div>
            )}
        </div>

        {batchError && (
          <div className="flex items-start gap-2 p-4 bg-danger/8 border border-danger/25 rounded-lg">
            <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
            <p className="text-[12px] text-foreground/80 leading-relaxed">{batchError}</p>
          </div>
        )}

        {hasPartialRepo && (
          <div className="flex flex-col gap-3 p-4 bg-warning/8 border border-warning/25 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-[12px] text-foreground/80 leading-relaxed">
                At least one selected repository uses a <strong className="text-warning">PARTIAL</strong>{" "}
                snapshot. Analysis results may be incomplete.
              </p>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledgePartial}
                onChange={(event) => setAcknowledgePartial(event.target.checked)}
                className="w-4 h-4 rounded border-warning accent-warning"
              />
              <span className="text-[12px] font-medium text-foreground">
                I acknowledge partial snapshot coverage and want to proceed.
              </span>
            </label>
          </div>
        )}
      </div>
      <div className="px-6 py-4 border-t border-border/60 bg-surface-muted/30 flex justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 shadow-none"
          onClick={handleBack}
        >
          ← Back
        </Button>
        <Button
          size="sm"
          className="h-8 shadow-none"
          disabled={!canProceed || loading || !isAdmin}
          onClick={handleSubmit}
          title={!isAdmin ? "Admin role required to run analyses." : undefined}
        >
          {loading
            ? "Starting..."
            : selectedRepos.length > 1
              ? "Run Analyses"
              : "Run Analysis"}
        </Button>
      </div>
    </div>
  )
}
