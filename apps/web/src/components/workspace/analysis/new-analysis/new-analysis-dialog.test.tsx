import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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
const mockCreateAnalysis = jest.fn<(input: {
  revisionId: string
  data: { snapshotId: string; sourceTargetId: string; requestKey: string }
}) => Promise<{
  id: string
  status?: string
  error?: { message: string } | null
}>>()
const mockCreateMultiRepoAnalyses = jest.fn()
const mockToastSuccess = jest.fn()
const mockToastError = jest.fn()

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
jest.mock("@/i18n/navigation", () => ({ useLocalizedHref: () => (path: string) => path }))
jest.mock("@/lib/project-context", () => ({ useCurrentWorkspace: () => ({ membershipRole: "ANALYST" }) }))
jest.mock("@/lib/permissions", () => ({ canRunAnalysis: () => true }))
jest.mock("@/hooks/api/use-requirements", () => ({ useRequirements: () => mockRequirements }))
jest.mock("@/hooks/api/use-repositories", () => ({ useRepositories: () => mockRepositories }))
jest.mock("@/hooks/api/use-domain-packs", () => ({ useDomainPacks: () => ({ data: { items: [] }, isLoading: false, error: null }) }))
jest.mock("@/hooks/api/use-analyses", () => ({
  useCreateAnalysis: () => ({ mutateAsync: mockCreateAnalysis, isPending: false }),
  useCreateMultiRepoAnalyses: () => ({ mutateAsync: mockCreateMultiRepoAnalyses, isPending: false }),
}))
jest.mock("sonner", () => ({ toast: { success: mockToastSuccess, error: mockToastError } }))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { NewAnalysisDialog } = require("./new-analysis-dialog") as typeof import("./new-analysis-dialog")

describe("NewAnalysisDialog", () => {
  afterEach(() => {
    cleanup()
    mockPush.mockClear()
    mockCreateAnalysis.mockReset()
    mockCreateMultiRepoAnalyses.mockReset()
    mockToastSuccess.mockReset()
    mockToastError.mockReset()
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

  it("reuses the same request key when a failed analysis submission is retried", async () => {
    const user = userEvent.setup()
    mockCreateAnalysis
      .mockRejectedValueOnce(new Error("temporary event persistence failure"))
      .mockResolvedValueOnce({ id: "analysis-1" })

    render(
      <NewAnalysisDialog
        preselectedReqId="requirement-1"
        preselectedReqRevisionId="revision-final"
        preselectedRepoId="repository-1"
      >
        <button>Run analysis</button>
      </NewAnalysisDialog>,
    )

    await user.click(screen.getByRole("button", { name: "Run analysis" }))
    await screen.findByText("abcdef123456")
    await user.click(screen.getByRole("button", { name: "runAnalysis" }))
    await waitFor(() => expect(mockCreateAnalysis).toHaveBeenCalledTimes(1))
    expect(screen.getByText("temporary event persistence failure")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "runAnalysis" }))
    await waitFor(() => expect(mockCreateAnalysis).toHaveBeenCalledTimes(2))

    const [firstAttempt, retryAttempt] = mockCreateAnalysis.mock.calls.map(([input]) => input)
    expect(retryAttempt).toEqual(firstAttempt)
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/analyses/analysis-1"))
  })

  it("does not treat an idempotent FAILED response as success and uses a new key for explicit rerun", async () => {
    const user = userEvent.setup()
    mockCreateAnalysis
      .mockRejectedValueOnce(new Error("queue offline"))
      .mockResolvedValueOnce({
        id: "analysis-1",
        status: "FAILED",
        error: { message: "Queue enqueue failed." },
      })
      .mockResolvedValueOnce({ id: "analysis-2", status: "QUEUED" })

    render(
      <NewAnalysisDialog
        preselectedReqId="requirement-1"
        preselectedReqRevisionId="revision-final"
        preselectedRepoId="repository-1"
      >
        <button>Run analysis</button>
      </NewAnalysisDialog>,
    )

    await user.click(screen.getByRole("button", { name: "Run analysis" }))
    await screen.findByText("abcdef123456")
    const submit = () => screen.getByRole("button", { name: "runAnalysis" })
    await user.click(submit())
    await waitFor(() => expect(mockCreateAnalysis).toHaveBeenCalledTimes(1))
    await user.click(submit())
    await waitFor(() => expect(mockCreateAnalysis).toHaveBeenCalledTimes(2))

    expect(mockToastSuccess).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.getByText("Queue enqueue failed.")).toBeInTheDocument()

    await user.click(submit())
    await waitFor(() => expect(mockCreateAnalysis).toHaveBeenCalledTimes(3))
    const requestKeys = mockCreateAnalysis.mock.calls.map(([input]) => input.data.requestKey)
    expect(requestKeys[1]).toBe(requestKeys[0])
    expect(requestKeys[2]).not.toBe(requestKeys[1])
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/analyses/analysis-2"))
  })
})
