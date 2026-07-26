import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, jest, beforeEach } from "@jest/globals"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"
import { analysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"

// uuid v14 ships ESM only; jest does not transform it. The request key is opaque
// to these tests, so a stable stub is sufficient.
jest.mock("uuid", () => ({ v4: () => "test-request-key" }))

const push = jest.fn()
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))

const mutateAsync = jest.fn<(input: unknown) => Promise<{ id: string }>>()
jest.mock("@/hooks/api/use-analyses", () => ({
  useCreateAnalysis: () => ({ mutateAsync, isPending: false }),
}))

let latestSnapshot: unknown = { id: "snap-latest", commitSha: "def4567", coverageStatus: "READY" }
jest.mock("@/hooks/api/use-repositories", () => ({
  useRepositoryDetail: () => ({ data: { latestSnapshot } }),
}))
jest.mock("@/lib/project-context", () => ({ useOptionalProjectId: () => "proj-1" }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const rerun = require("./rerun-analysis-dialog") as typeof import("./rerun-analysis-dialog")

const labels = analysisWorkspaceLabels.en.rerunDialog

function buildWorkspace(): AnalysisWorkspaceResponse {
  return {
    overview: {
      analysisId: "analysis-old",
      requirement: { revisionId: "rev-1" },
      snapshot: { repositoryId: "repo-1" },
    },
    driftStatus: { sourceTargetId: "target-1" },
  } as unknown as AnalysisWorkspaceResponse
}

describe("buildRerunAnalysisRequest", () => {
  it("derives a new analysis from the current one against the latest snapshot", () => {
    const request = rerun.buildRerunAnalysisRequest(
      buildWorkspace(),
      { id: "snap-latest", coverageStatus: "READY" },
      "key-1",
    )
    expect(request).toEqual({
      revisionId: "rev-1",
      data: {
        snapshotId: "snap-latest",
        sourceTargetId: "target-1",
        allowPartialSnapshot: false,
        requestKey: "key-1",
        derivedFromAnalysisId: "analysis-old",
      },
    })
  })

  it("allows a partial snapshot when the latest snapshot is partial", () => {
    const request = rerun.buildRerunAnalysisRequest(
      buildWorkspace(),
      { id: "snap", coverageStatus: "PARTIAL" },
      "key",
    )
    expect(request?.data.allowPartialSnapshot).toBe(true)
  })

  it("returns null when the latest snapshot or source target is missing", () => {
    expect(rerun.buildRerunAnalysisRequest(buildWorkspace(), null, "key")).toBeNull()
    const noTarget = {
      ...buildWorkspace(),
      driftStatus: { sourceTargetId: null },
    } as unknown as AnalysisWorkspaceResponse
    expect(rerun.buildRerunAnalysisRequest(noTarget, { id: "snap" }, "key")).toBeNull()
  })
})

describe("RerunAnalysisDialog", () => {
  afterEach(cleanup)
  beforeEach(() => {
    push.mockClear()
    mutateAsync.mockReset()
    latestSnapshot = { id: "snap-latest", commitSha: "def4567", coverageStatus: "READY" }
  })

  it("creates a derived analysis and navigates to it on confirm", async () => {
    mutateAsync.mockResolvedValue({ id: "analysis-new" })
    render(
      <rerun.RerunAnalysisDialog workspace={buildWorkspace()} labels={labels}>
        <button>Re-run</button>
      </rerun.RerunAnalysisDialog>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Re-run" }))
    fireEvent.click(await screen.findByRole("button", { name: labels.confirm }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        revisionId: "rev-1",
        data: expect.objectContaining({
          snapshotId: "snap-latest",
          sourceTargetId: "target-1",
          derivedFromAnalysisId: "analysis-old",
        }),
      }),
    )
    await waitFor(() => expect(push).toHaveBeenCalledWith("/analyses/analysis-new"))
  })

  it("disables confirm when the latest snapshot is unavailable", async () => {
    latestSnapshot = null
    render(
      <rerun.RerunAnalysisDialog workspace={buildWorkspace()} labels={labels}>
        <button>Re-run</button>
      </rerun.RerunAnalysisDialog>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Re-run" }))
    const confirm = await screen.findByRole("button", { name: labels.confirm })
    expect(confirm).toBeDisabled()
    expect(mutateAsync).not.toHaveBeenCalled()
  })
})
