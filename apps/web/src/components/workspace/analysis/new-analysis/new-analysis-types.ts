import { RequirementListItemResponse, RepositoryListItemResponse, MultiRepoImpactAnalysisCreateResponse } from "@ba-helper/contracts"

export type Step = 1 | 2 | 3

export interface NewAnalysisDialogProps {
  children: React.ReactNode
  preselectedRepoId?: string
  preselectedReqId?: string
  preselectedReqRevisionId?: string
  derivedFromAnalysisId?: string
  sourceClarificationId?: string
  oldAnalysisSnapshotCommit?: string
}

export interface RequirementSelectionStepProps {
  reqsLoading: boolean
  reqsError: Error | null
  readyReqs: RequirementListItemResponse[]
  selectedReq: RequirementListItemResponse | null
  setSelectedReq: (req: RequirementListItemResponse) => void
  handleNext: () => void
}

export interface RepositorySelectionStepProps {
  reposLoading: boolean
  reposError: Error | null
  readyRepos: RepositoryListItemResponse[]
  selectedRepos: RepositoryListItemResponse[]
  toggleRepository: (repo: RepositoryListItemResponse) => void
  hasPreselectedReq: boolean
  handleBack: () => void
  handleNext: () => void
}

export interface ConfirmationStepProps {
  selectedReq: RequirementListItemResponse
  preselectedReqRevisionId?: string
  selectedRepos: RepositoryListItemResponse[]
  oldAnalysisSnapshotCommit?: string
  hasPartialRepo: boolean
  acknowledgePartial: boolean
  setAcknowledgePartial: (val: boolean) => void
  batchSuccess: MultiRepoImpactAnalysisCreateResponse | null
  batchError: string | null
  canProceed: boolean
  loading: boolean
  canRun: boolean
  handleBack: () => void
  handleSubmit: () => void
  handleOpenRun: () => void
}
