import { render, screen } from "@testing-library/react"
import type {
  AnalysisWorkspaceResponse,
  ImpactAnalysisDiffResponse,
  LineageTimelineResponse,
} from "@ba-helper/contracts"
import { analysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { LineageDiffTab } from "./lineage-diff-tab"

const mockUseAnalysisDiff = jest.fn()
const mockUseAnalysisLineage = jest.fn()

jest.mock("@/hooks/api/use-analyses", () => ({
  useAnalysisDiff: () => mockUseAnalysisDiff(),
  useAnalysisLineage: () => mockUseAnalysisLineage(),
}))

const workspace = {
  overview: {
    analysisId: "00000000-0000-4000-8000-000000000002",
    requirement: {
      revisionId: "00000000-0000-4000-8000-000000000004",
      title: "Cancel paid booking",
      summary: "Allow refunds for paid booking cancellation.",
      language: "en",
      domainProfileId: "booking@1",
    },
    snapshot: {
      snapshotId: "00000000-0000-4000-8000-000000000006",
      repositoryId: "00000000-0000-4000-8000-000000000099",
      commitSha: "current-commit",
      analyzerVersion: "test",
    },
    status: {
      analysisStatus: "WAITING_FOR_REVIEW",
      reviewStatus: "in_progress",
      snapshotStatus: "locked",
      reportStatus: "missing",
      driftStatus: "fresh",
    },
    counts: {
      impactedArtifacts: 1,
      evidenceItems: 0,
      risks: 0,
      unknowns: 1,
      qaScenarios: 1,
      pendingReviewItems: 1,
    },
  },
  impactGroups: [],
  evidenceCards: [],
  risks: [],
  unknowns: [],
  qaScenarios: [],
  reviewQueue: [],
  reportStatus: {
    status: "missing",
    generatedDocumentId: null,
    documentJobId: null,
    reviewedReportSnapshotId: null,
    canFinalize: false,
    requiresUnreviewedAcknowledgement: false,
    canViewReport: false,
    canExport: false,
    canRetryReportGeneration: false,
    finalizeBlockingReasons: [],
    exportBlockingReasons: ["REPORT_NOT_GENERATED"],
    lastGeneratedAt: null,
    failureMessage: null,
  },
  driftStatus: {
    status: "fresh",
    isStale: false,
    basis: "latest_observed_source_target",
    sourceTargetId: null,
    latestObservedCommitSha: "current-commit",
    snapshotCommitSha: "current-commit",
    reason: null,
  },
} satisfies AnalysisWorkspaceResponse

const diff = {
  baseAnalysisId: "00000000-0000-4000-8000-000000000001",
  currentAnalysisId: "00000000-0000-4000-8000-000000000002",
  comparisonContext: {
    requirementChanged: true,
    snapshotChanged: true,
    baseRequirementRevisionId: "00000000-0000-4000-8000-000000000003",
    currentRequirementRevisionId: "00000000-0000-4000-8000-000000000004",
    baseSnapshotId: "00000000-0000-4000-8000-000000000005",
    currentSnapshotId: "00000000-0000-4000-8000-000000000006",
    baseCommitSha: "base-commit",
    currentCommitSha: "current-commit",
    sourceClarificationId: "00000000-0000-4000-8000-000000000007",
    reviewClarificationRequestId: "00000000-0000-4000-8000-000000000008",
  },
  summary: {
    addedImpacts: 1,
    removedImpacts: 1,
    unchangedImpacts: 1,
    resolvedUnknowns: 1,
    removedUnknowns: 0,
    newUnknowns: 1,
    addedQaScenarios: 1,
  },
  addedArtifacts: [
    {
      artifactKey: "service:new",
      name: "NewService.run",
      artifactType: "SERVICE_METHOD",
      universalKind: "DOMAIN_SERVICE",
      filePath: "src/new.service.ts",
      reviewStatus: "NEEDS_REVIEW",
    },
  ],
  removedArtifacts: [
    {
      artifactKey: "service:old",
      name: "OldService.run",
      artifactType: "SERVICE_METHOD",
      universalKind: "DOMAIN_SERVICE",
      filePath: "src/old.service.ts",
      reviewStatus: "CONFIRMED",
    },
  ],
  unchangedArtifacts: [
    {
      artifactKey: "service:same",
      name: "SameService.run",
      artifactType: "SERVICE_METHOD",
      universalKind: "DOMAIN_SERVICE",
      filePath: "src/same.service.ts",
      reviewStatus: "CONFIRMED",
    },
  ],
  resolvedUnknowns: [
    {
      insightKey: "unknown:old",
      category: "UNKNOWN",
      statement: "Refund deadline was unclear.",
      reviewStatus: "CONFIRMED",
    },
  ],
  removedUnknowns: [],
  newUnknowns: [
    {
      insightKey: "unknown:new",
      category: "UNKNOWN",
      statement: "Inventory release timing is unclear.",
      reviewStatus: "NEEDS_REVIEW",
    },
  ],
  addedQaScenarios: [
    {
      insightKey: "qa:new",
      category: "QA_SCENARIO",
      statement: "Given paid booking, when cancelled, then refund is created once.",
      reviewStatus: "NEEDS_REVIEW",
    },
  ],
} satisfies ImpactAnalysisDiffResponse

const lineage: LineageTimelineResponse = {
  rootAnalysisId: diff.baseAnalysisId,
  currentAnalysisId: diff.currentAnalysisId,
  depth: 1,
  events: [],
}

function renderTab() {
  return render(
    <LineageDiffTab
      workspace={workspace}
      locale="en"
      labels={analysisWorkspaceLabels.en.lineageDiff}
    />,
  )
}

describe("LineageDiffTab", () => {
  beforeEach(() => {
    mockUseAnalysisDiff.mockReset()
    mockUseAnalysisLineage.mockReset()
  })

  it("renders not applicable state when analysis has no parent", () => {
    mockUseAnalysisDiff.mockReturnValue({
      data: undefined,
      error: { code: "NO_BASELINE_ANALYSIS" },
      isLoading: false,
      refetch: jest.fn(),
    })
    mockUseAnalysisLineage.mockReturnValue({ data: undefined, isLoading: false })

    renderTab()

    expect(screen.getByText("No lineage diff for this analysis")).toBeInTheDocument()
    expect(screen.getByText("Not applicable")).toBeInTheDocument()
  })

  it("renders lineage summary and diff groups from backend diff", () => {
    mockUseAnalysisDiff.mockReturnValue({
      data: diff,
      error: null,
      isLoading: false,
      refetch: jest.fn(),
    })
    mockUseAnalysisLineage.mockReturnValue({ data: lineage, isLoading: false })

    renderTab()

    expect(screen.getByText("Available")).toBeInTheDocument()
    expect(screen.getByText("NewService.run")).toBeInTheDocument()
    expect(screen.getByText("OldService.run")).toBeInTheDocument()
    expect(screen.getByText("Refund deadline was unclear.")).toBeInTheDocument()
    expect(screen.getByText("Inventory release timing is unclear.")).toBeInTheDocument()
    expect(screen.getByText("Given paid booking, when cancelled, then refund is created once.")).toBeInTheDocument()
  })

  it("does not invent evidence diff when backend does not expose it", () => {
    mockUseAnalysisDiff.mockReturnValue({
      data: diff,
      error: null,
      isLoading: false,
      refetch: jest.fn(),
    })
    mockUseAnalysisLineage.mockReturnValue({ data: lineage, isLoading: false })

    renderTab()

    expect(screen.getByText("Evidence-level diff is not available for this analysis pair.")).toBeInTheDocument()
  })
})
