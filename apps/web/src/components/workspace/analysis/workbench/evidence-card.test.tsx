import { render, screen } from "@testing-library/react"
import { describe, expect, it, jest } from "@jest/globals"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import { analysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { EvidenceCard, buildSourceUrl } from "./evidence-card"

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const labels = analysisWorkspaceLabels.en.reviewWorkbench

type Evidence = AnalysisWorkspaceResponse["evidenceCards"][number]

function evidence(over: Partial<Evidence> = {}): Evidence {
  return {
    evidenceId: "e1",
    sourceType: "code",
    filePath: "src/booking/booking.controller.ts",
    lineRange: { startLine: 10, endLine: 22 },
    excerpt: "cancel()",
    relevanceReason: "Cancellation endpoint.",
    artifactId: "a1",
    artifactKey: "api:booking.controller.cancel",
    linkedInsightIds: [],
    linkedTraceabilityLinkIds: [],
    ...over,
  } as Evidence
}

describe("buildSourceUrl", () => {
  const lines = { startLine: 10, endLine: 22 }

  it("builds a GitHub blob permalink with a multi-line anchor", () => {
    expect(buildSourceUrl("https://github.com/acme/booking", "abc123", "src/x.ts", lines)).toBe(
      "https://github.com/acme/booking/blob/abc123/src/x.ts#L10-L22",
    )
  })

  it("strips a .git suffix, trailing slash, and a leading path slash; single-line anchor", () => {
    expect(
      buildSourceUrl("https://github.com/acme/booking.git/", "sha", "/src/x.ts", {
        startLine: 5,
        endLine: 5,
      }),
    ).toBe("https://github.com/acme/booking/blob/sha/src/x.ts#L5")
  })

  it("returns null for a missing url / commit / path or a non-GitHub host", () => {
    expect(buildSourceUrl(null, "sha", "src/x.ts", lines)).toBeNull()
    expect(buildSourceUrl("https://github.com/acme/booking", null, "src/x.ts", lines)).toBeNull()
    expect(buildSourceUrl("https://github.com/acme/booking", "sha", null, lines)).toBeNull()
    expect(buildSourceUrl("https://gitlab.com/acme/booking", "sha", "src/x.ts", lines)).toBeNull()
  })
})

describe("EvidenceCard source navigation", () => {
  it("renders an Open source permalink to the pinned commit when a repository url is available", () => {
    render(
      <EvidenceCard
        evidence={evidence()}
        labels={labels}
        commitSha="abc1234def"
        repositoryUrl="https://github.com/acme/booking"
      />,
    )
    const link = screen.getByRole("link", { name: labels.openSource })
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/acme/booking/blob/abc1234def/src/booking/booking.controller.ts#L10-L22",
    )
  })

  it("falls back to the copyable path:line reference when there is no repository url", () => {
    render(<EvidenceCard evidence={evidence()} labels={labels} commitSha="abc1234def" repositoryUrl={null} />)
    expect(screen.queryByRole("link", { name: labels.openSource })).toBeNull()
    expect(screen.getByRole("button", { name: labels.copyLocation })).toBeInTheDocument()
  })
})
