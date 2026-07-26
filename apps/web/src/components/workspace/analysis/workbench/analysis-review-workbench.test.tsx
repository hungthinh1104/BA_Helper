import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import { analysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"

const push = jest.fn()
jest.mock("next/navigation", () => ({
  usePathname: () => "/analyses/a1",
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams("view=review"),
}))

jest.mock("@/hooks/api/use-analyses", () => ({
  useImpactGraph: () => ({ data: undefined, isLoading: false }),
}))

// GraphTab (imported by the workbench) transitively pulls in next-intl (ESM),
// which jest does not transform. The workbench test does not exercise it.
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
  useFormatter: () => ({ number: (value: number) => String(value), dateTime: () => "" }),
}))

const decide = jest.fn((_vars: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.())
let pending = false
jest.mock("@/hooks/api/use-review-item-decision", () => {
  const actual = jest.requireActual("@/hooks/api/use-review-item-decision") as Record<string, unknown>
  return {
    ...actual,
    useReviewItemDecision: () => ({ decide, isPending: pending, error: null, pendingItemId: null, reset: jest.fn() }),
  }
})

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AnalysisReviewWorkbench } = require("./analysis-review-workbench") as typeof import("./analysis-review-workbench")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createAnalysisWorkbenchViewModel } = require("./analysis-workbench-view-model") as typeof import("./analysis-workbench-view-model")

const queueItem = (id: string): AnalysisWorkspaceResponse["reviewQueue"][number] => ({
  itemId: id,
  itemType: "impact",
  title: `Item ${id}`,
  currentDecision: "needs_review",
  evidenceCount: 1,
  linkedArtifactKeys: [],
  linkedEvidenceIds: [],
  blockingFinalize: true,
})

const workspace: AnalysisWorkspaceResponse = {
  overview: {
    analysisId: "a1",
    requirement: { revisionId: "r1", title: "T", summary: "", language: "en", domainProfileId: "d", domainPack: null },
    snapshot: { snapshotId: "s1", repositoryId: "repo1", commitSha: "c", analyzerVersion: "v" },
    status: { analysisStatus: "WAITING_FOR_REVIEW", reviewStatus: "in_progress", snapshotStatus: "locked", reportStatus: "missing", driftStatus: "fresh" },
    counts: { impactedArtifacts: 2, evidenceItems: 0, risks: 0, unknowns: 0, qaScenarios: 0, pendingReviewItems: 2 },
  },
  impactGroups: [],
  evidenceCards: [],
  risks: [],
  unknowns: [],
  qaScenarios: [],
  reviewQueue: [queueItem("first"), queueItem("second")],
  reportStatus: { status: "missing", generatedDocumentId: null, documentJobId: null, reviewedReportSnapshotId: null, canFinalize: false, requiresUnreviewedAcknowledgement: false, canViewReport: false, canExport: false, canRetryReportGeneration: false, finalizeBlockingReasons: [], exportBlockingReasons: [], lastGeneratedAt: null, failureMessage: null },
  driftStatus: { status: "fresh", isStale: false, basis: "pinned_commit", sourceTargetId: null, latestObservedCommitSha: null, snapshotCommitSha: "c", reason: null },
}

const labels = analysisWorkspaceLabels.en

function renderWorkbench() {
  const viewModel = createAnalysisWorkbenchViewModel(workspace)
  return render(
    <AnalysisReviewWorkbench
      workspace={workspace}
      viewModel={viewModel}
      locale="en"
      labels={labels.reviewWorkbench}
      queueLabels={labels.reviewQueue}
      graphLabels={labels.graph}
    />,
  )
}

describe("AnalysisReviewWorkbench decision loop", () => {
  beforeEach(() => {
    push.mockClear()
    decide.mockClear()
    pending = false
  })

  it("accepts the item and auto-advances to the next", () => {
    renderWorkbench()
    fireEvent.click(screen.getByRole("button", { name: "Accept" }))
    expect(decide).toHaveBeenCalledTimes(1)
    expect((decide.mock.calls[0][0] as { action: string }).action).toBe("accept")
    // onSuccess ran → advanced to the second item.
    expect(push).toHaveBeenCalledWith(expect.stringContaining("item=second"), { scroll: false })
  })

  it("blocks reject until a rationale is entered", () => {
    renderWorkbench()
    fireEvent.click(screen.getByRole("button", { name: "Reject" }))
    expect(decide).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(labels.reviewWorkbench.decision.rationaleLabel), {
      target: { value: "duplicate" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Reject" }))
    expect(decide).toHaveBeenCalledTimes(1)
    expect((decide.mock.calls[0][0] as { action: string; rationale: string })).toMatchObject({
      action: "reject",
      rationale: "duplicate",
    })
  })

  it("triggers accept from the keyboard shortcut", () => {
    renderWorkbench()
    fireEvent.keyDown(document.body, { key: "a" })
    expect(decide).toHaveBeenCalledTimes(1)
    expect((decide.mock.calls[0][0] as { action: string }).action).toBe("accept")
  })

  it("does not fire shortcuts while typing a rationale", () => {
    renderWorkbench()
    const textarea = screen.getByLabelText(labels.reviewWorkbench.decision.rationaleLabel)
    fireEvent.keyDown(textarea, { key: "a" })
    expect(decide).not.toHaveBeenCalled()
  })

  it("disables actions while a mutation is in flight (no double submit)", () => {
    pending = true
    renderWorkbench()
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled()
  })
})
