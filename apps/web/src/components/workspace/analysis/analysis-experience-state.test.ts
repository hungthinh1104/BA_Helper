import { describe, expect, it } from "@jest/globals"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import { resolveAnalysisExperienceState } from "./analysis-experience-state"

type QueueItem = AnalysisWorkspaceResponse["reviewQueue"][number]

const item = (overrides: Partial<QueueItem>): QueueItem => ({
  itemId: overrides.itemId ?? "i",
  itemType: overrides.itemType ?? "impact",
  title: "t",
  currentDecision: overrides.currentDecision ?? "needs_review",
  evidenceCount: overrides.evidenceCount ?? 1,
  linkedArtifactKeys: [],
  linkedEvidenceIds: [],
  blockingFinalize: overrides.blockingFinalize ?? false,
})

const workspace = (overrides: {
  queue?: QueueItem[]
  isStale?: boolean
  canFinalize?: boolean
  canViewReport?: boolean
  finalizeBlockingReasons?: string[]
}): AnalysisWorkspaceResponse =>
  ({
    reviewQueue: overrides.queue ?? [],
    driftStatus: { isStale: overrides.isStale ?? false },
    reportStatus: {
      canFinalize: overrides.canFinalize ?? false,
      canViewReport: overrides.canViewReport ?? false,
      finalizeBlockingReasons: overrides.finalizeBlockingReasons ?? [],
    },
  }) as unknown as AnalysisWorkspaceResponse

describe("resolveAnalysisExperienceState", () => {
  it("counts blockers, pending and evidence gaps; needs_more_evidence is not reviewed", () => {
    const state = resolveAnalysisExperienceState(
      workspace({
        queue: [
          item({ itemId: "a", currentDecision: "needs_review", blockingFinalize: true, evidenceCount: 1 }),
          item({ itemId: "b", currentDecision: "needs_review", blockingFinalize: false, evidenceCount: 0 }),
          item({ itemId: "c", currentDecision: "needs_more_evidence" }),
          item({ itemId: "d", currentDecision: "accepted" }),
        ],
      }),
    )
    expect(state.blockers).toBe(1)
    expect(state.pending).toBe(2) // a + b, not c (needs_more_evidence) or d (accepted)
    expect(state.evidenceGaps).toBe(2) // c (needs_more_evidence) + b (unreviewed, no evidence)
    expect(state.primaryAction).toBe("continue_review")
    expect(state.recommendedMode).toBe("review")
    expect(state.recommendedFilter).toBe("blocking")
  })

  it("prioritises rerun for a stale snapshot", () => {
    const state = resolveAnalysisExperienceState(
      workspace({ isStale: true, queue: [item({ currentDecision: "needs_review", blockingFinalize: true })] }),
    )
    expect(state.primaryAction).toBe("rerun")
    expect(state.recommendedMode).toBe("history")
  })

  it("offers finalize once review is complete", () => {
    const state = resolveAnalysisExperienceState(
      workspace({ queue: [item({ currentDecision: "accepted" })], canFinalize: true }),
    )
    expect(state.primaryAction).toBe("finalize")
    expect(state.recommendedFilter).toBe("pending")
  })

  it("offers view report when finalized and nothing pending", () => {
    const state = resolveAnalysisExperienceState(
      workspace({ queue: [item({ currentDecision: "accepted" })], canViewReport: true }),
    )
    expect(state.primaryAction).toBe("view_report")
    expect(state.recommendedMode).toBe("summary")
  })
})
