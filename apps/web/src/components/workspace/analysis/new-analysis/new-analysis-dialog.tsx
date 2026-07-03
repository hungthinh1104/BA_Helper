"use client"

import { useCallback, useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useCurrentWorkspace } from "@/lib/project-context"
import { canRunAnalysis } from "@/lib/permissions"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { useRequirements } from "@/hooks/api/use-requirements"
import { useRepositories } from "@/hooks/api/use-repositories"
import { useCreateAnalysis, useCreateMultiRepoAnalyses } from "@/hooks/api/use-analyses"
import { useDomainPacks } from "@/hooks/api/use-domain-packs"
import { RequirementListItemResponse, RepositoryListItemResponse, MultiRepoImpactAnalysisCreateResponse } from "@ba-helper/contracts"
import { X } from "lucide-react"
import { toast } from "sonner"
import { NewAnalysisDialogProps, Step } from "./new-analysis-types"
import {
  getAnalysisErrorMessage,
  repositoryNeedsPartialAcknowledgement,
} from "./new-analysis-utils"
import { RequirementSelectionStep } from "./requirement-selection-step"
import { RepositorySelectionStep } from "./repository-selection-step"
import { ConfirmationStep } from "./confirmation-step"
import { StepProgress } from "./step-progress"
import { useLocalizedHref } from "@/i18n/navigation"

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
  const href = useLocalizedHref()
  const t = useTranslations("newAnalysis")
  const { data: reqData, isLoading: reqsLoading, error: reqsError } = useRequirements()
  const { data: repoData, isLoading: reposLoading, error: reposError } = useRepositories()
  const { data: domainPackData, isLoading: domainPacksLoading, error: domainPacksError } = useDomainPacks()
  const { mutateAsync: createAnalysis, isPending: singleLoading } = useCreateAnalysis()
  const { mutateAsync: createMultiRepoAnalyses, isPending: multiLoading } = useCreateMultiRepoAnalyses()

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>(1)
  const [selectedReq, setSelectedReq] = useState<RequirementListItemResponse | null>(null)
  const [selectedRepos, setSelectedRepos] = useState<RepositoryListItemResponse[]>([])
  const [selectedDomainPackId, setSelectedDomainPackId] = useState<string | null>(null)
  const [acknowledgePartial, setAcknowledgePartial] = useState(false)
  const [batchSuccess, setBatchSuccess] = useState<MultiRepoImpactAnalysisCreateResponse | null>(null)
  const [batchError, setBatchError] = useState<string | null>(null)
  const workspace = useCurrentWorkspace()
  const canRun = workspace ? canRunAnalysis(workspace.membershipRole) : false

  const loading = singleLoading || multiLoading
  const domainPacks = domainPackData?.items ?? []

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
        (r) => r.canStartAnalysis,
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
  const hasPartialRepo = useMemo(
    () => selectedRepos.some(repositoryNeedsPartialAcknowledgement),
    [selectedRepos],
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
    setSelectedDomainPackId(null)
    setBatchSuccess(null)
    setBatchError(null)
  }

  const toggleRepository = useCallback((repo: RepositoryListItemResponse) => {
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
  }, [hasPreselectedRepo])

  const handleRepositoryBack = useCallback(() => setStep(1), [])
  const handleRepositoryNext = useCallback(() => setStep(3), [])
  const handleConfirmBack = useCallback(
    () => setStep(hasPreselectedRepo ? 1 : 2),
    [hasPreselectedRepo],
  )

  const handleSubmit = async () => {
    if (!selectedReq || selectedRepos.length === 0) return

    const effectiveRevisionId = preselectedReqRevisionId ?? selectedReq.latestRevision.id
    setBatchError(null)

    try {
      if (selectedRepos.length === 1) {
        const repo = selectedRepos[0]
        const sourceTargetId = repo.latestTarget?.id
        if (!sourceTargetId) {
          toast.error(t("cannotStartAnalysis"), {
            description: t("noResolvedTarget"),
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
            ...(selectedDomainPackId ? { domainPackId: selectedDomainPackId } : {}),
            derivedFromAnalysisId,
            sourceClarificationId,
          },
        })

        toast.success(t("analysisStarted"))
        setOpen(false)
        reset()
        router.push(href(`/analyses/${newAnalysis.id}`))
        return
      }

      const result = await createMultiRepoAnalyses({
        requirementRevisionId: effectiveRevisionId,
        repositoryIds: selectedRepos.map((repo) => repo.id),
        allowPartialSnapshot: acknowledgePartial,
        requestKey: crypto.randomUUID(),
        ...(selectedDomainPackId ? { domainPackId: selectedDomainPackId } : {}),
      })

      setBatchSuccess(result)
      toast.success(t("createdAnalyses", { count: result.items.length }))
    } catch (err: unknown) {
      const description = getAnalysisErrorMessage(err)
      setBatchError(description)
      toast.error(t("failedToStartAnalyses"), {
        description,
      })
    }
  }

  const stepLabel = [t("stepRequirement"), t("stepRepository"), t("stepConfirm")]

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
    router.push(href(`/analyses/runs/${runId}`))
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
            <DialogTitle className="text-[15px]">{t("title")}</DialogTitle>
            <DialogClose className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
          <StepProgress
            currentStep={step}
            labels={stepLabel}
            hasPreselectedRepo={hasPreselectedRepo}
            hasPreselectedRequirement={hasPreselectedReq}
          />
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
            handleBack={handleRepositoryBack}
            handleNext={handleRepositoryNext}
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
            domainPacks={domainPacks}
            domainPacksLoading={domainPacksLoading}
            domainPacksError={domainPacksError}
            selectedDomainPackId={selectedDomainPackId}
            setSelectedDomainPackId={setSelectedDomainPackId}
            batchSuccess={batchSuccess}
            batchError={batchError}
            canProceed={canProceedStep3}
            loading={loading}
            canRun={canRun}
            handleBack={handleConfirmBack}
            handleSubmit={handleSubmit}
            handleOpenRun={handleOpenRun}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
