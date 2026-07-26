import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, jest, beforeEach } from "@jest/globals"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import { analysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"

const push = jest.fn()
jest.mock("next/navigation", () => ({
  usePathname: () => "/analyses/a1",
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}))

// The finalize dialog pulls in next-intl + mutation hooks; render its trigger only.
jest.mock("./finalize-analysis-dialog", () => ({
  FinalizeAnalysisDialog: ({ children }: { children: React.ReactNode }) => <div data-testid="finalize-dialog">{children}</div>,
  formatReviewApprovalBlocker: (reason: string) => reason,
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AnalysisPrimaryCta } = require("./analysis-primary-cta") as typeof import("./analysis-primary-cta")

const queueItem = (decision: AnalysisWorkspaceResponse["reviewQueue"][number]["currentDecision"], blocking = false): AnalysisWorkspaceResponse["reviewQueue"][number] => ({
  itemId: `i-${Math.random()}`,
  itemType: "impact",
  title: "t",
  currentDecision: decision,
  evidenceCount: 1,
  linkedArtifactKeys: [],
  linkedEvidenceIds: [],
  blockingFinalize: blocking,
})

const workspace = (over: {
  queue?: AnalysisWorkspaceResponse["reviewQueue"]
  isStale?: boolean
  canFinalize?: boolean
  canViewReport?: boolean
  finalizeBlockingReasons?: string[]
}): AnalysisWorkspaceResponse =>
  ({
    overview: { analysisId: "a1", snapshot: { commitSha: "abcdef1" }, counts: { unknowns: 0 } },
    impactGroups: [],
    reviewQueue: over.queue ?? [],
    reportStatus: { canFinalize: over.canFinalize ?? false, canViewReport: over.canViewReport ?? false, finalizeBlockingReasons: over.finalizeBlockingReasons ?? [], requiresUnreviewedAcknowledgement: false, exportBlockingReasons: [] },
    driftStatus: { isStale: over.isStale ?? false },
  }) as unknown as AnalysisWorkspaceResponse

const labels = analysisWorkspaceLabels.en

const renderCta = (ws: AnalysisWorkspaceResponse) => render(<AnalysisPrimaryCta workspace={ws} labels={labels} />)

describe("AnalysisPrimaryCta", () => {
  beforeEach(() => push.mockClear())

  it("continues review and lands on the blocking filter", () => {
    renderCta(workspace({ queue: [queueItem("needs_review", true)] }))
    const button = screen.getByRole("button", { name: labels.primaryCta.continueReview })
    fireEvent.click(button)
    expect(push).toHaveBeenCalledWith(expect.stringContaining("view=review"), { scroll: false })
    expect(push).toHaveBeenCalledWith(expect.stringContaining("filter=blocking"), { scroll: false })
    expect(screen.getByText("1 blockers")).toBeInTheDocument()
  })

  it("offers finalize through the dialog when review is complete", () => {
    renderCta(workspace({ queue: [queueItem("accepted")], canFinalize: true }))
    expect(screen.getByTestId("finalize-dialog")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: labels.primaryCta.finalize })).toBeInTheDocument()
  })

  it("routes to the approved report when finalized", () => {
    renderCta(workspace({ queue: [queueItem("accepted")], canViewReport: true }))
    fireEvent.click(screen.getByRole("button", { name: labels.primaryCta.viewReport }))
    expect(push).toHaveBeenCalledWith("/reports?analysisId=a1")
  })

  it("surfaces a rerun CTA for a stale analysis", () => {
    renderCta(workspace({ isStale: true, queue: [queueItem("needs_review", true)] }))
    fireEvent.click(screen.getByRole("button", { name: labels.primaryCta.rerun }))
    expect(push).toHaveBeenCalledWith(expect.stringContaining("view=history"), { scroll: false })
  })

  it("shows blocker reasons beside the CTA", () => {
    renderCta(workspace({ queue: [queueItem("accepted")], finalizeBlockingReasons: ["CRITICAL_MISSING_EVIDENCE"] }))
    expect(screen.getByText(labels.primaryCta.blockedTitle, { exact: false })).toBeInTheDocument()
    expect(screen.getByText(/CRITICAL_MISSING_EVIDENCE/)).toBeInTheDocument()
  })
})
