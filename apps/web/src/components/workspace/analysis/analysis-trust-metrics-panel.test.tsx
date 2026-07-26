import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "@jest/globals"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import { analysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { AnalysisTrustMetricsPanel, resolveTrustMetrics } from "./analysis-trust-metrics-panel"

function workspace(over: Record<string, unknown> = {}): AnalysisWorkspaceResponse {
  return {
    overview: { counts: { impactedArtifacts: 2, evidenceItems: 2 } },
    impactGroups: [{ group: "primary", artifacts: [{ evidenceIds: ["e1"] }, { evidenceIds: [] }] }],
    evidenceCards: [{ artifactId: "a1" }, { artifactId: null }],
    risks: [],
    qaScenarios: [],
    reviewSummary: {
      total: 4,
      pending: 1,
      blocking: 1,
      conflicting: 0,
      needsMoreEvidence: 1,
      reviewed: 2,
      accepted: 1,
      rejected: 1,
    },
    reportStatus: { finalizeBlockingReasons: ["REVIEW_REQUIRED_ITEMS", "CONFLICTING_EVIDENCE_UNREVIEWED"] },
    ...over,
  } as unknown as AnalysisWorkspaceResponse
}

describe("resolveTrustMetrics", () => {
  it("uses the backend reviewSummary for the resolved ratio and blocker count", () => {
    const metrics = resolveTrustMetrics(workspace())
    expect(metrics.reviewProgress).toBeCloseTo(0.5) // 2 reviewed / 4 total
    // A single backend blocking count — NOT summed with the two finalizeBlockingReasons.
    expect(metrics.blockers).toBe(1)
  })

  it("measures QA/risk coverage from the actual QA -> risk linkage", () => {
    const metrics = resolveTrustMetrics(
      workspace({
        overview: { counts: { impactedArtifacts: 0, evidenceItems: 0 } },
        risks: [
          { riskId: "r1", severity: "high" },
          { riskId: "r2", severity: "low" },
        ],
        qaScenarios: [{ relatedRiskIds: ["r1"] }],
      }),
    )
    expect(metrics.qaRiskCoverage).toBeCloseTo(0.5) // r1 covered, r2 not
    expect(metrics.highRiskUncovered).toBe(false) // the high-severity r1 IS covered
  })

  it("flags a high-severity risk with no linked QA scenario", () => {
    const metrics = resolveTrustMetrics(
      workspace({
        overview: { counts: { impactedArtifacts: 0, evidenceItems: 0 } },
        risks: [{ riskId: "r1", severity: "high" }],
        qaScenarios: [{ relatedRiskIds: ["other"] }],
      }),
    )
    expect(metrics.qaRiskCoverage).toBe(0)
    expect(metrics.highRiskUncovered).toBe(true)
  })

  it("treats coverage as complete when there are no risks", () => {
    expect(resolveTrustMetrics(workspace()).qaRiskCoverage).toBe(1)
  })
})

describe("AnalysisTrustMetricsPanel", () => {
  it("renders the backend blocker count as the review-progress hint", () => {
    render(
      <AnalysisTrustMetricsPanel workspace={workspace()} labels={analysisWorkspaceLabels.en.metrics} />,
    )
    expect(
      screen.getByText(analysisWorkspaceLabels.en.metrics.reviewProgressBlocked.replace("{count}", "1")),
    ).toBeInTheDocument()
  })
})
