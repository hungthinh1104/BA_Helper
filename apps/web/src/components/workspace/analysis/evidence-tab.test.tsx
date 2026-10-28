import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import { analysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"
import { EvidenceTab } from "./evidence-tab"

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
const toast = (jest.requireMock("sonner") as { toast: { success: jest.Mock; error: jest.Mock } }).toast

const evidence = {
  evidenceId: "e1",
  sourceType: "code",
  filePath: "src/booking/service.ts",
  lineRange: { startLine: 1, endLine: 2 },
  excerpt: "return true",
  relevanceReason: "Source excerpt",
  artifactId: "artifact-1",
  artifactKey: "service:booking",
  linkedInsightIds: [],
  linkedTraceabilityLinkIds: [],
} as AnalysisWorkspaceResponse["evidenceCards"][number]

describe("EvidenceTab clipboard feedback", () => {
  beforeEach(() => {
    toast.success.mockClear()
    toast.error.mockClear()
  })

  it("shows a failure message when copying an excerpt is rejected", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: jest.fn(async () => { throw new Error("permission denied") }) },
    })
    render(<EvidenceTab evidenceCards={[evidence]} labels={analysisWorkspaceLabels.en.evidence} />)

    fireEvent.click(screen.getByTitle(analysisWorkspaceLabels.en.evidence.copyExcerpt))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(analysisWorkspaceLabels.en.evidence.copyFailed))
    expect(toast.success).not.toHaveBeenCalled()
  })
})
