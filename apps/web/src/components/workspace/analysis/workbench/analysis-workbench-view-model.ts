import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import type {
  AnalysisWorkbenchViewModel,
  AnalysisWorkbenchIndexes,
  AnalysisWorkspaceMode,
  ReviewFilter,
  ReviewWorkbenchItem,
} from "./analysis-workbench-types"

type Workspace = AnalysisWorkspaceResponse

export function getDefaultAnalysisWorkspaceMode(workspace: Workspace): AnalysisWorkspaceMode {
  if (workspace.driftStatus.isStale) return "history"
  if (workspace.overview.counts.pendingReviewItems > 0) return "review"
  return "summary"
}

export function createAnalysisWorkbenchViewModel(
  workspace: Workspace,
  requestedItemId: string | null = null,
): AnalysisWorkbenchViewModel {
  const orderedReviewItems = orderReviewItems(workspace)
  const selectedItemId = orderedReviewItems.some((item) => item.itemId === requestedItemId)
    ? requestedItemId
    : orderedReviewItems[0]?.itemId ?? null

  return {
    defaultMode: getDefaultAnalysisWorkspaceMode(workspace),
    selectedItemId,
    orderedReviewItems,
    indexes: createAnalysisWorkbenchIndexes(workspace),
    counts: countReviewItems(orderedReviewItems),
  }
}

export function createAnalysisWorkbenchIndexes(workspace: Workspace): AnalysisWorkbenchIndexes {
  const artifacts = workspace.impactGroups.flatMap((group) => group.artifacts)
  const artifactByTraceabilityLinkId = new Map<string, typeof artifacts[number]>()
  for (const artifact of artifacts) {
    for (const traceabilityLinkId of artifact.traceabilityLinkIds) {
      artifactByTraceabilityLinkId.set(traceabilityLinkId, artifact)
    }
  }

  return {
    artifactByTraceabilityLinkId,
    evidenceById: new Map(workspace.evidenceCards.map((evidence) => [evidence.evidenceId, evidence])),
    riskById: new Map(workspace.risks.flatMap((risk) => [[risk.riskId, risk], ...(risk.sourceInsightId ? [[risk.sourceInsightId, risk] as const] : [])])),
    unknownById: new Map(workspace.unknowns.flatMap((unknown) => [[unknown.unknownId, unknown], ...(unknown.sourceInsightId ? [[unknown.sourceInsightId, unknown] as const] : [])])),
    qaScenarioById: new Map(workspace.qaScenarios.flatMap((scenario) => [[scenario.scenarioId, scenario], ...(scenario.sourceInsightId ? [[scenario.sourceInsightId, scenario] as const] : [])])),
    artifactByKey: new Map(artifacts.map((artifact) => [artifact.artifactKey, artifact])),
  }
}

export function orderReviewItems(workspace: Workspace): ReviewWorkbenchItem[] {
  const artifactBasisByKey = new Map(
    workspace.impactGroups.flatMap((group) => group.artifacts)
      .map((artifact) => [artifact.artifactKey, artifact.impactBasis] as const),
  )

  return workspace.reviewQueue
    .map((item, index) => ({
      ...item,
      impactBasis: item.linkedArtifactKeys
        .map((key) => artifactBasisByKey.get(key))
        .find((basis) => basis !== undefined) ?? null,
      isConflictingImpactBasis: item.linkedArtifactKeys.some(
        (key) => artifactBasisByKey.get(key) === "conflicting",
      ),
      backendIndex: index,
    }))
    .sort((left, right) => reviewItemRank(left) - reviewItemRank(right) || left.backendIndex - right.backendIndex)
    .map((rankedItem) => {
      const { backendIndex, ...item } = rankedItem
      void backendIndex
      return item
    })
}

export function filterReviewItems(
  items: ReviewWorkbenchItem[],
  filter: ReviewFilter,
): ReviewWorkbenchItem[] {
  switch (filter) {
    case "blocking":
      return items.filter((item) => item.blockingFinalize && item.currentDecision === "needs_review")
    case "pending":
      return items.filter((item) => item.currentDecision === "needs_review")
    case "conflicting":
      return items.filter((item) => item.isConflictingImpactBasis)
    case "needs_more_evidence":
      return items.filter((item) => item.currentDecision === "needs_more_evidence")
    case "reviewed":
      return items.filter((item) => item.currentDecision === "accepted" || item.currentDecision === "rejected")
    default:
      return items
  }
}

export function resolveReviewItemDetail(workspace: Workspace, viewModel: AnalysisWorkbenchViewModel, item: ReviewWorkbenchItem) {
  const artifact = viewModel.indexes.artifactByTraceabilityLinkId.get(item.itemId) ?? item.linkedArtifactKeys.map((key) => viewModel.indexes.artifactByKey.get(key)).find(Boolean) ?? null
  const risk = viewModel.indexes.riskById.get(item.itemId)
  const unknown = viewModel.indexes.unknownById.get(item.itemId)
  const qaScenario = viewModel.indexes.qaScenarioById.get(item.itemId)
  const artifactKeys = new Set([...(artifact ? [artifact.artifactKey] : []), ...item.linkedArtifactKeys])
  const evidenceIds = new Set([...item.linkedEvidenceIds, ...(artifact?.evidenceIds ?? []), ...(item.itemType === "evidence" ? [item.itemId] : [])])
  const evidence = [...evidenceIds].flatMap((id) => {
    const value = viewModel.indexes.evidenceById.get(id)
    return value ? [value] : []
  })
  const related = <T extends { relatedArtifactKeys: string[]; relatedEvidenceIds: string[] }>(items: T[]) => items.filter((candidate) => candidate.relatedArtifactKeys.some((key) => artifactKeys.has(key)) || candidate.relatedEvidenceIds.some((id) => evidenceIds.has(id)))
  const risks = unique([...(risk ? [risk] : []), ...related(workspace.risks)])
  const unknowns = unique([...(unknown ? [unknown] : []), ...related(workspace.unknowns), ...risks.flatMap((value) => value.relatedUnknownIds.map((id) => viewModel.indexes.unknownById.get(id)).filter(Boolean) as Workspace["unknowns"][number][])])
  const qaScenarios = unique([...(qaScenario ? [qaScenario] : []), ...related(workspace.qaScenarios), ...workspace.qaScenarios.filter((scenario) => scenario.relatedRiskIds.some((id) => risks.some((riskItem) => riskItem.riskId === id)) || scenario.relatedUnknownIds.some((id) => unknowns.some((unknownItem) => unknownItem.unknownId === id)))])
  return { artifact, evidence, risks, unknowns, qaScenarios, traceabilityIds: artifact?.traceabilityLinkIds ?? [] }
}

function reviewItemRank(item: ReviewWorkbenchItem & { backendIndex: number }) {
  if (item.blockingFinalize && item.currentDecision === "needs_review") return 0
  if (item.isConflictingImpactBasis) return 1
  if (item.currentDecision === "needs_more_evidence") return 2
  if (item.currentDecision === "needs_review" && item.evidenceCount === 0) return 3
  if (item.currentDecision === "needs_review") return 4
  return 5
}

function countReviewItems(items: ReviewWorkbenchItem[]) {
  return {
    total: items.length,
    pending: items.filter((item) => item.currentDecision === "needs_review").length,
    blocking: items.filter((item) => item.blockingFinalize && item.currentDecision === "needs_review").length,
    conflicting: items.filter((item) => item.isConflictingImpactBasis).length,
    needsMoreEvidence: items.filter((item) => item.currentDecision === "needs_more_evidence").length,
    reviewed: items.filter((item) => item.currentDecision === "accepted" || item.currentDecision === "rejected").length,
  }
}

function unique<T extends { riskId?: string; unknownId?: string; scenarioId?: string }>(items: T[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const id = item.riskId ?? item.unknownId ?? item.scenarioId
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}
