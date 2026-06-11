"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useRequirements } from "@/hooks/api/use-requirements"
import { useRepositories } from "@/hooks/api/use-repositories"
import { useCreateAnalysis } from "@/hooks/api/use-analyses"
import { useAuth } from "@/hooks/use-auth"
import { RequirementListItemResponse, RepositoryListItemResponse } from "@ba-helper/contracts"
import { X, ChevronRight, AlertTriangle, Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface NewAnalysisDialogProps {
  children: React.ReactNode
  preselectedRepoId?: string
  preselectedReqId?: string
  preselectedReqRevisionId?: string
  derivedFromAnalysisId?: string
  sourceClarificationId?: string
  oldAnalysisSnapshotCommit?: string
}

type Step = 1 | 2 | 3

export function NewAnalysisDialog({ 
  children, 
  preselectedRepoId, 
  preselectedReqId,
  preselectedReqRevisionId,
  derivedFromAnalysisId,
  sourceClarificationId,
  oldAnalysisSnapshotCommit
}: NewAnalysisDialogProps) {
  const router = useRouter()
  const { data: reqData, isLoading: reqsLoading, error: reqsError } = useRequirements()
  const { data: repoData, isLoading: reposLoading, error: reposError } = useRepositories()
  const { mutateAsync: createAnalysis, isPending: loading } = useCreateAnalysis()

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>(1)
  const [selectedReq, setSelectedReq] = useState<RequirementListItemResponse | null>(null)
  const [selectedRepo, setSelectedRepo] = useState<RepositoryListItemResponse | null>(null)
  const [acknowledgePartial, setAcknowledgePartial] = useState(false)
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const readyRepos = useMemo(() => repoData?.items.filter(r =>
    r.latestScanJob?.status === "COMPLETED" && r.latestSnapshot?.id
  ) || [], [repoData])
  
  const readyReqs = useMemo(() => reqData?.items.filter(r => 
    r.latestRevision.readinessStatus === "READY_FOR_ANALYSIS"
  ) || [], [reqData])

  useEffect(() => {
    if (open) {
      if (preselectedRepoId && readyRepos.length > 0 && !selectedRepo) {
        const repo = readyRepos.find(r => r.id === preselectedRepoId)
        if (repo) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setSelectedRepo(repo)
        }
      }
      if (preselectedReqId && readyReqs.length > 0 && !selectedReq) {
        const req = readyReqs.find(r => r.id === preselectedReqId)
        if (req) {
          setSelectedReq(req)
          setStep(2)
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedRepoId, preselectedReqId, open, readyRepos, readyReqs])

  const isPartial = selectedRepo?.latestSnapshot?.coverageStatus === "PARTIAL"
  const canProceedStep3 = !isPartial || acknowledgePartial

  const reset = () => {
    setStep(preselectedReqId ? 2 : 1)
    if (!preselectedReqId) {
      setSelectedReq(null)
    }
    if (!preselectedRepoId) {
      setSelectedRepo(null)
    }
    setAcknowledgePartial(false)
  }

  const handleSubmit = async () => {
    if (!selectedReq || !selectedRepo) return
    const sourceTargetId = selectedRepo.latestTarget?.id
    if (!sourceTargetId) {
      toast.error("Cannot start analysis", {
        description: "Repository has no resolved target. Run a scan first.",
      })
      return
    }
    const effectiveRevisionId = preselectedReqRevisionId ?? selectedReq.latestRevision.id
    try {
      const newAnalysis = await createAnalysis({
        revisionId: effectiveRevisionId,
        data: {
          snapshotId: selectedRepo.latestSnapshot!.id,
          sourceTargetId,
          requestKey: crypto.randomUUID(),
          allowPartialSnapshot: acknowledgePartial,
          derivedFromAnalysisId,
          sourceClarificationId,
        }
      })
      toast.success("Analysis started successfully")
      setOpen(false)
      reset()
      router.push(`/analyses/${newAnalysis.id}`)
    } catch (err: unknown) {
      toast.error("Failed to start analysis", {
        description: err instanceof Error ? err.message : "Please try again.",
      })
    }
  }

  const stepLabel = ["Select Requirement", "Select Repository", "Confirm & Run"]

  const handleNextFromStep1 = () => {
    if (preselectedRepoId) {
      setStep(3) // Skip step 2 if repo is preselected
    } else {
      setStep(2)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-background/70 backdrop-blur-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.3)] ring-1 ring-white/10 dark:ring-white/5" showCloseButton={false}>
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[15px]">New Impact Analysis</DialogTitle>
            <DialogClose className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
          {/* Step indicators */}
          <div className="flex items-center gap-1 mt-3">
            {([1, 2, 3] as Step[]).filter(s => !(preselectedRepoId && s === 2) && !(preselectedReqId && s === 1)).map((s, i, arr) => (
              <div key={s} className="flex items-center gap-1">
                <div className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
                  step === s ? "text-foreground" : step > s ? "text-success" : "text-muted-foreground/50"
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                    step > s ? "bg-success text-white" : step === s ? "bg-foreground text-background" : "bg-surface-muted border border-border text-muted-foreground"
                  }`}>
                    {step > s ? "✓" : s === 3 && preselectedRepoId ? "2" : s === 3 && preselectedReqId ? "2" : s === 2 && preselectedReqId ? "1" : s}
                  </div>
                  <span className="hidden sm:inline">{stepLabel[s - 1]}</span>
                </div>
                {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-border mx-1" />}
              </div>
            ))}
          </div>
        </DialogHeader>

        {/* Step 1: Select Requirement (Hidden if preselected) */}
        {step === 1 && !preselectedReqId && (
          <div className="flex flex-col">
            <div className="px-6 py-4 flex flex-col gap-2 max-h-72 overflow-y-auto">
              {reqsLoading ? (
                <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-[13px]">Loading requirements...</span>
                </div>
              ) : reqsError ? (
                <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
                  <AlertCircle className="w-5 h-5 text-danger" />
                  <span className="text-[13px]">Failed to load requirements.</span>
                </div>
              ) : readyReqs.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-muted-foreground">
                  No READY requirements. Create and qualify a requirement first.
                </div>
              ) : readyReqs.map((req) => (
                <button
                  key={req.id}
                  onClick={() => setSelectedReq(req)}
                  className={`text-left p-3.5 rounded-lg border transition-all ${
                    selectedReq?.id === req.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/60 bg-surface hover:bg-surface-soft hover:border-border"
                  }`}
                >
                  <p className="text-[13px] font-medium text-foreground">{req.latestRevision.title}</p>
                  <p className="text-[11px] text-muted-foreground font-mono mt-1">{req.latestRevision.id}</p>
                  <p className="text-[12px] text-muted-foreground/70 mt-1 line-clamp-2 leading-relaxed">{req.latestRevision.rawText}</p>
                </button>
              ))}
            </div>
            <div className="-mx-0 px-6 py-4 border-t border-border/60 bg-surface-muted/30 flex justify-end">
              <Button size="sm" className="h-8 shadow-none" disabled={!selectedReq} onClick={handleNextFromStep1}>
                Next →
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Select Repository/Snapshot (Hidden if preselected) */}
        {step === 2 && !preselectedRepoId && (
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
                <div className="py-8 text-center text-[13px] text-muted-foreground">
                  No indexed repositories. Connect a repository and wait for the scan to complete.
                </div>
              ) : readyRepos.map(repo => {
                const coverage = repo.latestSnapshot?.coverageStatus
                return (
                  <button
                    key={repo.id}
                    onClick={() => { setSelectedRepo(repo); setAcknowledgePartial(false) }}
                    className={`text-left p-3.5 rounded-lg border transition-all ${
                      selectedRepo?.id === repo.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border/60 bg-surface hover:bg-surface-soft hover:border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <p className="text-[13px] font-mono font-medium text-foreground">{repo.displayName}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase border ${
                        coverage === "READY"
                          ? "bg-success/10 text-success border-success/50"
                          : "bg-warning/10 text-warning border-warning/50"
                      }`}>{coverage}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 font-mono">
                      {repo.canonicalUrl.replace("https://github.com/", "")} · {repo.latestTarget?.requestedRef}
                    </p>
                  </button>
                )
              })}
            </div>
            <div className="-mx-0 px-6 py-4 border-t border-border/60 bg-surface-muted/30 flex justify-between gap-2">
              {!preselectedReqId && (
                <Button variant="outline" size="sm" className="h-8 shadow-none" onClick={() => setStep(1)}>← Back</Button>
              )}
              <div className={preselectedReqId ? "w-full flex justify-end" : ""}>
                <Button size="sm" className="h-8 shadow-none" disabled={!selectedRepo} onClick={() => setStep(3)}>Next →</Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && selectedReq && selectedRepo && (
          <div className="flex flex-col">
            <div className="px-6 py-5 flex flex-col gap-4">
              {/* Summary table */}
              <div className="flex flex-col divide-y divide-border/60 border border-border/60 rounded-lg overflow-hidden bg-surface-muted/30">
                <SummaryRow label="Requirement" value={selectedReq.latestRevision.title} mono={false} />
                <SummaryRow label="Revision ID" value={preselectedReqRevisionId ?? selectedReq.latestRevision.id} />
                <SummaryRow label="Repository" value={selectedRepo.displayName} mono={false} />
                <SummaryRow label="Snapshot" value={selectedRepo.latestSnapshot?.id ?? "—"} />
                <SummaryRow label="Commit" value={selectedRepo.latestSnapshot?.commitSha ?? "—"} />
                <SummaryRow label="Coverage" value={selectedRepo.latestSnapshot?.coverageStatus ?? "—"} />
                {oldAnalysisSnapshotCommit && selectedRepo.latestSnapshot?.commitSha !== oldAnalysisSnapshotCommit && (
                  <div className="px-4 py-3 flex gap-2 items-start bg-blue-500/10 text-blue-500/90 text-[12px] leading-snug">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>
                      This analysis will use a newer repository snapshot (<strong>{selectedRepo.latestSnapshot?.commitSha.slice(0, 7)}</strong>) than the original analysis (<strong>{oldAnalysisSnapshotCommit.slice(0, 7)}</strong>).
                    </p>
                  </div>
                )}
              </div>

              {/* Partial acknowledgement */}
              {isPartial && (
                <div className="flex flex-col gap-3 p-4 bg-warning/8 border border-warning/25 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                    <p className="text-[12px] text-foreground/80 leading-relaxed">
                      This snapshot has <strong className="text-warning">PARTIAL</strong> coverage — some files were skipped during extraction. Analysis results may be incomplete.
                    </p>
                  </div>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acknowledgePartial}
                      onChange={e => setAcknowledgePartial(e.target.checked)}
                      className="w-4 h-4 rounded border-warning accent-warning"
                    />
                    <span className="text-[12px] font-medium text-foreground">I acknowledge this partial snapshot and want to proceed.</span>
                  </label>
                </div>
              )}
            </div>
            <div className="-mx-0 px-6 py-4 border-t border-border/60 bg-surface-muted/30 flex justify-between gap-2">
              <Button variant="outline" size="sm" className="h-8 shadow-none" onClick={() => setStep(preselectedRepoId ? 1 : 2)}>← Back</Button>
              <Button size="sm" className="h-8 shadow-none" disabled={!canProceedStep3 || loading || !isAdmin} onClick={handleSubmit} title={!isAdmin ? "Admin role required to run analyses." : undefined}>
                {loading ? "Starting..." : "Run Analysis"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SummaryRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 px-4 py-2.5">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider self-center">{label}</span>
      <span className={`text-[12px] text-foreground/90 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  )
}
