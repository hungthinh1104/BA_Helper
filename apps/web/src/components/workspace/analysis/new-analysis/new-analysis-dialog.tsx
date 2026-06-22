"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useCurrentWorkspace } from "@/lib/project-context"
import { canRunAnalysis } from "@/lib/permissions"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { useRequirements } from "@/hooks/api/use-requirements"
import { useRepositories } from "@/hooks/api/use-repositories"
import { useCreateAnalysis, useCreateMultiRepoAnalyses } from "@/hooks/api/use-analyses"
import { RequirementListItemResponse, RepositoryListItemResponse, MultiRepoImpactAnalysisCreateResponse } from "@ba-helper/contracts"
import { X, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { NewAnalysisDialogProps, Step } from "./new-analysis-types"
import { getAnalysisErrorMessage } from "./new-analysis-utils"
import { RequirementSelectionStep } from "./requirement-selection-step"
import { RepositorySelectionStep } from "./repository-selection-step"
import { ConfirmationStep } from "./confirmation-step"

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
  const workspace = useCurrentWorkspace()
  const canRun = workspace ? canRunAnalysis(workspace.membershipRole) : false

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
  const hasPartialRepo = selectedRepos.some((repo) => {
    const profile = repo.latestSnapshot?.profile
    const maturity = profile 
      ? (profile.language === "TYPESCRIPT" && profile.framework === "NESTJS" ? "STABLE" 
        : profile.language === "JAVA" && profile.framework === "SPRING_BOOT" ? "PARTIAL" 
        : profile.framework !== "UNKNOWN" ? "EXPERIMENTAL" : "UNKNOWN")
      : "—"
    return repo.latestSnapshot?.coverageStatus === "PARTIAL" || maturity === "PARTIAL" || maturity === "EXPERIMENTAL"
  })
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
        className="overflow-hidden bg-background p-0 shadow-xl sm:max-w-lg"
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
          <RequirementSelectionStep
            reqsLoading={reqsLoading}
            reqsError={reqsError}
            readyReqs={readyReqs}
            selectedReq={selectedReq}
            setSelectedReq={setSelectedReq}
            handleNext={handleNextFromStep1}
          />
        )}

        {step === 2 && !hasPreselectedRepo && (
          <RepositorySelectionStep
            reposLoading={reposLoading}
            reposError={reposError}
            readyRepos={readyRepos}
            selectedRepos={selectedRepos}
            toggleRepository={toggleRepository}
            hasPreselectedReq={hasPreselectedReq}
            handleBack={() => setStep(1)}
            handleNext={() => setStep(3)}
          />
        )}

        {step === 3 && selectedReq && selectedRepos.length > 0 && (
          <ConfirmationStep
            selectedReq={selectedReq}
            preselectedReqRevisionId={preselectedReqRevisionId}
            selectedRepos={selectedRepos}
            oldAnalysisSnapshotCommit={oldAnalysisSnapshotCommit}
            hasPartialRepo={hasPartialRepo}
            acknowledgePartial={acknowledgePartial}
            setAcknowledgePartial={setAcknowledgePartial}
            batchSuccess={batchSuccess}
            batchError={batchError}
            canProceed={canProceedStep3}
            loading={loading}
            canRun={canRun}
            handleBack={() => setStep(hasPreselectedRepo ? 1 : 2)}
            handleSubmit={handleSubmit}
            handleOpenRun={handleOpenRun}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
