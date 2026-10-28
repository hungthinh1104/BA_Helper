import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, jest } from "@jest/globals"
jest.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
jest.mock("@/lib/project-context", () => ({ useCurrentWorkspace: jest.fn() }))
jest.mock("@/hooks/api/use-traceability", () => ({
  useUpdateTraceabilityReviewDecision: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeleteTraceabilityReviewDecision: () => ({ mutateAsync: jest.fn(), isPending: false }),
}))
jest.mock("sonner", () => ({ toast: { error: jest.fn() } }))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useCurrentWorkspace } = require("@/lib/project-context") as typeof import("@/lib/project-context")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ReviewDecisionControls } = require("./review-decision-controls") as typeof import("./review-decision-controls")
const mockUseCurrentWorkspace = jest.mocked(useCurrentWorkspace)

describe("ReviewDecisionControls", () => {
  afterEach(() => {
    cleanup()
    jest.clearAllMocks()
  })

  it("keeps the decision read-only for a project viewer", () => {
    mockUseCurrentWorkspace.mockReturnValue({ membershipRole: "VIEWER" } as never)

    render(<ReviewDecisionControls analysisId="analysis-id" linkId="link-id" />)

    expect(screen.getByText("noDecision")).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("keeps stale report decisions read-only even for a reviewer", () => {
    mockUseCurrentWorkspace.mockReturnValue({ membershipRole: "REVIEWER" } as never)

    render(<ReviewDecisionControls analysisId="analysis-id" linkId="link-id" isReadOnly />)

    expect(screen.getByText("noDecision")).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("offers the editor to a reviewer on a current report", () => {
    mockUseCurrentWorkspace.mockReturnValue({ membershipRole: "REVIEWER" } as never)

    render(<ReviewDecisionControls analysisId="analysis-id" linkId="link-id" />)

    expect(screen.getByRole("button", { name: "noDecision" })).toBeInTheDocument()
  })
})
