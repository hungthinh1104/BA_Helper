import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, jest } from "@jest/globals"

const mockRequirements = {
  data: {
    items: [
      {
        id: "requirement-1",
        canStartAnalysis: true,
        latestRevision: {
          id: "revision-latest",
          title: "Refund cancelled booking",
          rawText: "A paid booking can be cancelled and refunded.",
        },
      },
    ],
  },
  isLoading: false,
  error: null,
}

const mockRepositories = {
  data: {
    items: [
      {
        id: "repository-1",
        displayName: "booking",
        canonicalUrl: "https://github.com/example/booking",
        latestScanJob: { status: "COMPLETED" },
        latestSnapshot: {
          id: "snapshot-1",
          commitSha: "abcdef123456",
          coverageStatus: "READY",
          profile: { language: "TYPESCRIPT", framework: "NESTJS" },
        },
        latestTarget: { id: "target-1", requestedRef: "main" },
      },
    ],
  },
  isLoading: false,
  error: null,
}

const mockPush = jest.fn()

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
jest.mock("@/i18n/navigation", () => ({ useLocalizedHref: () => (path: string) => path }))
jest.mock("@/lib/project-context", () => ({ useCurrentWorkspace: () => ({ membershipRole: "ANALYST" }) }))
jest.mock("@/lib/permissions", () => ({ canRunAnalysis: () => true }))
jest.mock("@/hooks/api/use-requirements", () => ({ useRequirements: () => mockRequirements }))
jest.mock("@/hooks/api/use-repositories", () => ({ useRepositories: () => mockRepositories }))
jest.mock("@/hooks/api/use-domain-packs", () => ({ useDomainPacks: () => ({ data: { items: [] }, isLoading: false, error: null }) }))
jest.mock("@/hooks/api/use-analyses", () => ({
  useCreateAnalysis: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useCreateMultiRepoAnalyses: () => ({ mutateAsync: jest.fn(), isPending: false }),
}))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { NewAnalysisDialog } = require("./new-analysis-dialog") as typeof import("./new-analysis-dialog")

describe("NewAnalysisDialog", () => {
  afterEach(() => {
    cleanup()
    mockPush.mockClear()
  })

  it("shows confirmation when requirement and repository are both preselected", async () => {
    render(
      <NewAnalysisDialog
        preselectedReqId="requirement-1"
        preselectedReqRevisionId="revision-converted"
        preselectedRepoId="repository-1"
      >
        <button>Run analysis</button>
      </NewAnalysisDialog>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Run analysis" }))

    expect(await screen.findByText("Refund cancelled booking")).toBeInTheDocument()
    expect(screen.getByText("revision-converted")).toBeInTheDocument()
    expect(screen.getByText("abcdef123456")).toBeInTheDocument()
  })
})
