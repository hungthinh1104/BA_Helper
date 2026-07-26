import { describe, expect, it } from "@jest/globals"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import { applyOptimisticDecision } from "./use-review-item-decision"

function workspace(
  items: Array<{ itemId: string; currentDecision: string }>,
): AnalysisWorkspaceResponse {
  return { reviewQueue: items } as unknown as AnalysisWorkspaceResponse
}

describe("applyOptimisticDecision", () => {
  it("updates only the decided item and does not mutate the input", () => {
    const before = workspace([
      { itemId: "a", currentDecision: "needs_review" },
      { itemId: "b", currentDecision: "needs_review" },
    ])
    const after = applyOptimisticDecision(before, "a", "accept")

    expect(after.reviewQueue[0].currentDecision).toBe("accepted")
    expect(after.reviewQueue[1].currentDecision).toBe("needs_review")
    // The snapshot used for rollback must stay intact.
    expect(before.reviewQueue[0].currentDecision).toBe("needs_review")
  })

  it("maps every action to its resulting decision, including undo", () => {
    const before = workspace([{ itemId: "a", currentDecision: "accepted" }])
    expect(applyOptimisticDecision(before, "a", "reject").reviewQueue[0].currentDecision).toBe("rejected")
    expect(applyOptimisticDecision(before, "a", "needs_more_evidence").reviewQueue[0].currentDecision).toBe(
      "needs_more_evidence",
    )
    expect(applyOptimisticDecision(before, "a", "undo").reviewQueue[0].currentDecision).toBe("needs_review")
  })
})
