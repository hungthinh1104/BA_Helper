import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, jest } from "@jest/globals"
import type { AnalysisWorkbenchViewModel } from "./analysis-workbench-types"

const push = jest.fn()

jest.mock("next/navigation", () => ({
  usePathname: () => "/analyses/analysis-1",
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams("view=review"),
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ReviewQueue } = require("./review-queue") as typeof import("./review-queue")

const labels = {
  title: "Decision queue",
  filterLabel: "Filter review items",
  pendingCount: "{count} pending decisions",
  blockingCount: "{count} blocks finalization",
  noBlockingItems: "No finalization blockers",
  blocking: "Blocking",
  notBlocking: "Not blocking",
  evidenceCount: "{count} evidence",
  artifactCount: "{count} linked artifacts",
  itemAriaLabel: "{title}. {type}. {decision}. {blocker}.",
  emptyTitle: "No review items",
  emptyDescription: "No backend review items are available for this analysis.",
  emptyFilteredTitle: "No matching review items",
  emptyFilteredDescription: "Try another filter to inspect the remaining review queue.",
  filters: {
    all: "All",
    blocking: "Blocking",
    pending: "Pending",
    conflicting: "Conflicting",
    needs_more_evidence: "Needs more evidence",
    reviewed: "Reviewed",
  },
} as const

const viewModel: AnalysisWorkbenchViewModel = {
  defaultMode: "review",
  selectedItemId: "blocker",
  counts: { total: 2, pending: 2, blocking: 1, conflicting: 0, needsMoreEvidence: 0, reviewed: 0 },
  indexes: {
    artifactByTraceabilityLinkId: new Map(),
    evidenceById: new Map(),
    riskById: new Map(),
    unknownById: new Map(),
    qaScenarioById: new Map(),
    artifactByKey: new Map(),
  },
  orderedReviewItems: [
    { itemId: "blocker", itemType: "impact", title: "Cancel booking", currentDecision: "needs_review", evidenceCount: 1, linkedArtifactKeys: ["BookingService.cancel"], linkedEvidenceIds: [], blockingFinalize: true, impactBasis: "evidenced", isConflictingImpactBasis: false },
    { itemId: "next", itemType: "risk", title: "Refund timing", currentDecision: "needs_review", evidenceCount: 0, linkedArtifactKeys: [], linkedEvidenceIds: [], blockingFinalize: false, impactBasis: null, isConflictingImpactBasis: false },
  ],
}

describe("ReviewQueue", () => {
  it("makes the backend-prioritized blocker selected and readable", () => {
    render(<ReviewQueue viewModel={viewModel} locale="en" labels={labels} />)
    expect(screen.getByRole("button", { name: /cancel booking\. impact\. needs review\. blocking/i }).getAttribute("aria-current")).toBe("true")
    expect(screen.queryByText("1 linked artifacts")).not.toBeNull()
  })

  it("uses the URL for filter and keyboard selection", () => {
    const { container } = render(<ReviewQueue viewModel={viewModel} locale="en" labels={labels} />)
    fireEvent.click(screen.getByRole("button", { name: /blocking 1/i }))
    expect(push).toHaveBeenCalledWith("/analyses/analysis-1?view=review&item=blocker&filter=blocking", { scroll: false })
    fireEvent.keyDown(container.querySelector("[data-review-queue]")!, { key: "ArrowDown" })
    expect(push).toHaveBeenLastCalledWith("/analyses/analysis-1?view=review&item=next", { scroll: false })
  })
})
