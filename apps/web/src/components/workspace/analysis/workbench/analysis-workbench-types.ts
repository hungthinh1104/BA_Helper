import type { AnalysisWorkspaceResponse, AnalysisWorkspaceReviewQueueItem } from "@ba-helper/contracts"

export type AnalysisWorkspaceMode = "summary" | "review" | "risks-qa" | "history"

export type ReviewFilter =
  | "all"
  | "blocking"
  | "pending"
  | "conflicting"
  | "needs_more_evidence"
  | "reviewed"

export type ReviewDisplay = "evidence" | "dependency-path"

export interface ReviewWorkbenchItem extends AnalysisWorkspaceReviewQueueItem {
  impactBasis: AnalysisWorkspaceResponse["impactGroups"][number]["artifacts"][number]["impactBasis"] | null
  isConflictingImpactBasis: boolean
}

export interface AnalysisWorkbenchIndexes {
  artifactByTraceabilityLinkId: Map<string, AnalysisWorkspaceResponse["impactGroups"][number]["artifacts"][number]>
  evidenceById: Map<string, AnalysisWorkspaceResponse["evidenceCards"][number]>
  riskById: Map<string, AnalysisWorkspaceResponse["risks"][number]>
  unknownById: Map<string, AnalysisWorkspaceResponse["unknowns"][number]>
  qaScenarioById: Map<string, AnalysisWorkspaceResponse["qaScenarios"][number]>
  artifactByKey: Map<string, AnalysisWorkspaceResponse["impactGroups"][number]["artifacts"][number]>
}

export interface AnalysisWorkbenchViewModel {
  defaultMode: AnalysisWorkspaceMode
  selectedItemId: string | null
  orderedReviewItems: ReviewWorkbenchItem[]
  indexes: AnalysisWorkbenchIndexes
  counts: {
    total: number
    pending: number
    blocking: number
    conflicting: number
    needsMoreEvidence: number
    reviewed: number
  }
}
