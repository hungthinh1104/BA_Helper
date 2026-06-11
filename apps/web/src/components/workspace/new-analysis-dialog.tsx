"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useRequirements } from "@/hooks/api/use-requirements"
import { useRepositories } from "@/hooks/api/use-repositories"
import { useCreateAnalysis, useCreateMultiRepoAnalyses } from "@/hooks/api/use-analyses"
import { useAuth } from "@/hooks/use-auth"
import { ApiError } from "@/lib/api-error"
import { RequirementListItemResponse, RepositoryListItemResponse, MultiRepoImpactAnalysisCreateResponse } from "@ba-helper/contracts"
import { X, ChevronRight, AlertTriangle, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
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
  oldAnalysisSnapshotCommit,
}: NewAnalysisDialogProps) {
  const router = useRouter()
  const { data: reqData, isLoading: reqsLoading, error: reqsError } = useRequirements()
  const { data: repoData, isLoading: reposLoading, error: reposError } = useRepositories()
  const { mutateAsync: createAnalysis, isPending: singleLoading } = useCreateAnalysis()
  const { mutateAsync: createMultiRepoAnalyses, isPending: multiLoading } = useCreateMultiRepoAnalyses()

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>(1)
  const [selectedReq, setSelectedReq] = useState<RequirementListItemResponse | null>(null)
  const [selectedRepos, setSelectedRepos] = useState<RepositoryListItemResponse[]>([])
  const [acknowledgePartial, setAcknowledgePartial] = useState(false)
  const [batchSuccess, setBatchSuccess] = useState<MultiRepoImpactAnalysisCreateResponse | null>(null)
  const [batchError, setBatchError] = useState<string | null>(null)
  const { user } = useAuth()
  const isAdmin = user?.role === "ADMIN"

  const loading = singleLoading || multiLoading

  const readyRepos = useMemo(
    () =>
      repoData?.items.filter(
        (r) => r.latestScanJob?.status === "COMPLETED" && r.latestSnapshot?.id,
      ) || [],
    [repoData],
  )

  const readyReqs = useMemo(
    () =>
      reqData?.items.filter(
        (r) => r.latestRevision.readinessStatus === "READY_FOR_ANALYSIS",
      ) || [],
    [reqData],
  )

  useEffect(() => {
    if (!open) return

    if (preselectedRepoId && readyRepos.length > 0 && selectedRepos.length === 0) {
      const repo = readyRepos.find((item) => item.id === preselectedRepoId)
      if (repo) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedRepos([repo])
      }
    }

    if (preselectedReqId && readyReqs.length > 0 && !selectedReq) {
      const req = readyReqs.find((item) => item.id === preselectedReqId)
      if (req) {
        setSelectedReq(req)
        setStep(2)
      }
    }
  }, [open, preselectedRepoId, preselectedReqId, readyRepos, readyReqs, selectedRepos.length, selectedReq])

  const hasPreselectedRepo = Boolean(preselectedRepoId)
  const hasPreselectedReq = Boolean(preselectedReqId)
  const selectedRepo = selectedRepos.length === 1 ? selectedRepos[0] : null
  const hasPartialRepo = selectedRepos.some(
    (repo) => repo.latestSnapshot?.coverageStatus === "PARTIAL",
  )
  const canProceedStep3 =
    selectedRepos.length > 0 && (!hasPartialRepo || acknowledgePartial)

  const reset = () => {
    setStep(preselectedReqId ? 2 : 1)
    if (!preselectedReqId) {
      setSelectedReq(null)
    }
    if (!preselectedRepoId) {
      setSelectedRepos([])
    }
    setAcknowledgePartial(false)
    setBatchSuccess(null)
    setBatchError(null)
  }

  const toggleRepository = (repo: RepositoryListItemResponse) => {
    if (hasPreselectedRepo) return

    setSelectedRepos((current) => {
      const exists = current.some((item) => item.id === repo.id)
      if (exists) {
        return current.filter((item) => item.id !== repo.id)
      }
      return [...current, repo]
    })
    setAcknowledgePartial(false)
    setBatchError(null)
  }

  const handleSubmit = async () => {
    if (!selectedReq || selectedRepos.length === 0) return

    const effectiveRevisionId = preselectedReqRevisionId ?? selectedReq.latestRevision.id
    setBatchError(null)

    try {
      if (selectedRepos.length === 1) {
        const repo = selectedRepos[0]
        const sourceTargetId = repo.latestTarget?.id
        if (!sourceTargetId) {
          toast.error("Cannot start analysis", {
            description: "Repository has no resolved target. Run a scan first.",
          })
          return
        }

        const newAnalysis = await createAnalysis({
          revisionId: effectiveRevisionId,
          data: {
            snapshotId: repo.latestSnapshot!.id,
            sourceTargetId,
            requestKey: crypto.randomUUID(),
            allowPartialSnapshot: acknowledgePartial,
            derivedFromAnalysisId,
            sourceClarificationId,
          },
        })

        toast.success("Analysis started successfully")
        setOpen(false)
        reset()
        router.push(`/analyses/${newAnalysis.id}`)
        return
      }

      const result = await createMultiRepoAnalyses({
        requirementRevisionId: effectiveRevisionId,
        repositoryIds: selectedRepos.map((repo) => repo.id),
        allowPartialSnapshot: acknowledgePartial,
        requestKey: crypto.randomUUID(),
      })

      setBatchSuccess(result)
      toast.success(`Created ${result.items.length} analyses`)
    } catch (err: unknown) {
      const description = getAnalysisErrorMessage(err)
      setBatchError(description)
      toast.error("Failed to start analyses", {
        description,
      })
    }
  }

  const stepLabel = ["Select Requirement", "Select Repository", "Confirm & Run"]

  const handleNextFromStep1 = () => {
    if (hasPreselectedRepo) {
      setStep(3)
    } else {
      setStep(2)
    }
  }

  const handleOpenRun = () => {
    if (!batchSuccess) return
    setOpen(false)
    const runId = batchSuccess.runId
    reset()
    router.push(`/analyses/runs/${runId}`)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (!value) reset()
      }}
    >
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent
        className="sm:max-w-lg p-0 overflow-hidden bg-background/70 backdrop-blur-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.3)] ring-1 ring-white/10 dark:ring-white/5"
        showCloseButton={false}
      >
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[15px]">New Impact Analysis</DialogTitle>
            <DialogClose className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
          <div className="flex items-center gap-1 mt-3">
            {([1, 2, 3] as Step[])
              .filter((item) => !(hasPreselectedRepo && item === 2) && !(hasPreselectedReq && item === 1))
              .map((item, index, arr) => (
                <div key={item} className="flex items-center gap-1">
                  <div
                    className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
                      step === item ? "text-foreground" : step > item ? "text-success" : "text-muted-foreground/50"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                        step > item
                          ? "bg-success text-white"
                          : step === item
                            ? "bg-foreground text-background"
                            : "bg-surface-muted border border-border text-muted-foreground"
                      }`}
                    >
                      {step > item
                        ? "✓"
                        : item === 3 && hasPreselectedRepo
                          ? "2"
                          : item === 3 && hasPreselectedReq
                            ? "2"
                            : item === 2 && hasPreselectedReq
                              ? "1"
                              : item}
                    </div>
                    <span className="hidden sm:inline">{stepLabel[item - 1]}</span>
                  </div>
                  {index < arr.length - 1 && <ChevronRight className="w-3 h-3 text-border mx-1" />}
                </div>
              ))}
          </div>
        </DialogHeader>

        {step === 1 && !hasPreselectedReq && (
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
              ) : (
                readyReqs.map((req) => (
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
                    <p className="text-[12px] text-muted-foreground/70 mt-1 line-clamp-2 leading-relaxed">
                      {req.latestRevision.rawText}
                    </p>
                  </button>
                ))
              )}
            </div>
            <div className="px-6 py-4 border-t border-border/60 bg-surface-muted/30 flex justify-end">
              <Button size="sm" className="h-8 shadow-none" disabled={!selectedReq} onClick={handleNextFromStep1}>
                Next →
              </Button>
            </div>
          </div>
        )}

        {step === 2 && !hasPreselectedRepo && (
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
                <Button variant="outline" size="sm" className="h-8 shadow-none" onClick={() => setStep(1)}>
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
                  onClick={() => setStep(3)}
                >
                  Next →
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && selectedReq && selectedRepos.length > 0 && (
          <div className="flex flex-col">
            {batchSuccess ? (
              <>
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
              </>
            ) : (
              <>
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
                    onClick={() => setStep(hasPreselectedRepo ? 1 : 2)}
                  >
                    ← Back
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 shadow-none"
                    disabled={!canProceedStep3 || loading || !isAdmin}
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
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

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

function getAnalysisErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "REPOSITORY_NOT_ANALYZABLE":
        return "One selected repository does not have a usable observed target or published snapshot. The batch stops on the first invalid repository in this phase."
      case "REPOSITORY_NOT_FOUND":
      case "INPUT_PROJECT_MISMATCH":
        return "One selected repository is not available in the current project. The batch stops on the first invalid repository in this phase."
      case "SNAPSHOT_PARTIAL_NOT_ALLOWED":
        return "At least one selected repository has partial coverage and requires acknowledgement before analysis can start."
      default:
        return error.message || "Please try again."
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return "Please try again."
}
