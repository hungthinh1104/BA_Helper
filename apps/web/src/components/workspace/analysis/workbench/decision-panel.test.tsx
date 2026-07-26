import type { ComponentProps } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, jest } from "@jest/globals"
import { analysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { DecisionPanel } from "./decision-panel"
import type { ReviewWorkbenchItem } from "./analysis-workbench-types"

const labels = analysisWorkspaceLabels.en.reviewWorkbench.decision

const item = (overrides: Partial<ReviewWorkbenchItem> = {}): ReviewWorkbenchItem => ({
  itemId: "link-1",
  itemType: "impact",
  title: "BookingService.cancel",
  currentDecision: "needs_review",
  evidenceCount: 1,
  linkedArtifactKeys: [],
  linkedEvidenceIds: [],
  blockingFinalize: true,
  impactBasis: "evidenced",
  isConflictingImpactBasis: false,
  ...overrides,
})

function renderPanel(props: Partial<ComponentProps<typeof DecisionPanel>> = {}) {
  const onDecide = jest.fn()
  const onNavigate = jest.fn()
  const onRetry = jest.fn()
  const onRationaleChange = jest.fn()
  render(
    <DecisionPanel
      item={item()}
      locale="en"
      labels={labels}
      rationale=""
      onRationaleChange={onRationaleChange}
      onDecide={onDecide}
      onNavigate={onNavigate}
      onRetry={onRetry}
      isPending={false}
      hasError={false}
      canPrevious={false}
      canNext
      {...props}
    />,
  )
  return { onDecide, onNavigate, onRetry, onRationaleChange }
}

describe("DecisionPanel", () => {
  it("gates reject and more-evidence behind a rationale, accept is always enabled", () => {
    const { onDecide } = renderPanel({ rationale: "" })
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "More evidence" })).toBeDisabled()
    const accept = screen.getByRole("button", { name: "Accept" })
    expect(accept).toBeEnabled()
    fireEvent.click(accept)
    expect(onDecide).toHaveBeenCalledWith("accept")
  })

  it("enables reject once a rationale is present", () => {
    const { onDecide } = renderPanel({ rationale: "duplicate link" })
    const reject = screen.getByRole("button", { name: "Reject" })
    expect(reject).toBeEnabled()
    fireEvent.click(reject)
    expect(onDecide).toHaveBeenCalledWith("reject")
  })

  it("limits insight items to accept/reject and shows the notice", () => {
    renderPanel({ item: item({ itemType: "risk", itemId: "insight-1" }), rationale: "x" })
    expect(screen.queryByRole("button", { name: "More evidence" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull()
    expect(screen.getByText(labels.insightLimited)).toBeInTheDocument()
  })

  it("disables undo until a decision exists", () => {
    renderPanel({ item: item({ currentDecision: "needs_review" }) })
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled()
  })

  it("enables undo once the item has a decision", () => {
    const { onDecide } = renderPanel({ item: item({ currentDecision: "accepted" }) })
    const undo = screen.getByRole("button", { name: "Undo" })
    expect(undo).toBeEnabled()
    fireEvent.click(undo)
    expect(onDecide).toHaveBeenCalledWith("undo")
  })

  it("disables every action while a mutation is in flight", () => {
    renderPanel({ isPending: true, rationale: "x" })
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled()
    expect(screen.getByRole("status")).toHaveTextContent(labels.saving)
  })

  it("surfaces an error with a retry", () => {
    const { onRetry } = renderPanel({ hasError: true })
    expect(screen.getByRole("alert")).toHaveTextContent(labels.errorTitle)
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(onRetry).toHaveBeenCalled()
  })

  it("navigates previous/next", () => {
    const { onNavigate } = renderPanel({ canPrevious: true, canNext: true })
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(onNavigate).toHaveBeenCalledWith(1)
    fireEvent.click(screen.getByRole("button", { name: "Previous" }))
    expect(onNavigate).toHaveBeenCalledWith(-1)
  })
})
