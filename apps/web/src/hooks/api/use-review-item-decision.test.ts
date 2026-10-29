import React from "react"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { act, renderHook, waitFor, cleanup } from "@testing-library/react"
import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals"
import { queryKeys } from "@/lib/api/query-keys"
import type { AnalysisWorkspaceResponse } from "@ba-helper/contracts"

const mockApiPut = jest.fn<(...args: unknown[]) => Promise<unknown>>()
jest.mock("@/lib/api-client", () => ({ apiPut: (...args: unknown[]) => mockApiPut(...args) }))
jest.mock("@/lib/project-context", () => ({ useOptionalProjectId: () => undefined }))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useReviewItemDecision } = require("./use-review-item-decision") as typeof import("./use-review-item-decision")

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function workspace(): AnalysisWorkspaceResponse {
  return {
    reviewQueue: [{ itemId: "link-1", currentDecision: "needs_review" }],
    reviewSummary: { total: 1, pending: 1, blocking: 1, conflicting: 0, needsMoreEvidence: 0, reviewed: 0, accepted: 0, rejected: 0 },
    reportStatus: { canFinalize: false },
  } as unknown as AnalysisWorkspaceResponse
}

function acceptedWorkspace(): AnalysisWorkspaceResponse {
  const before = workspace()
  return {
    ...before,
    reviewQueue: [{ ...before.reviewQueue[0], currentDecision: "accepted" }],
    reviewSummary: { ...before.reviewSummary, pending: 0, blocking: 0, reviewed: 1, accepted: 1 },
    reportStatus: { ...before.reportStatus, canFinalize: true },
  } as AnalysisWorkspaceResponse
}

describe("useReviewItemDecision", () => {
  let queryClient: QueryClient
  let mockWorkspaceRead: jest.Mock

  beforeEach(() => {
    mockApiPut.mockReset()
    mockWorkspaceRead = jest.fn()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  })

  afterEach(() => {
    cleanup()
    queryClient.clear()
  })

  it("keeps the review queue backend-confirmed until the decision request succeeds", async () => {
    const key = queryKeys.analyses.workspace("analysis-1")
    queryClient.setQueryData(key, workspace())
    const request = deferred<{ itemId: string; target: "impact"; currentDecision: "accepted"; reviewNote: null; idempotent: false }>()
    const refreshedRead = deferred<AnalysisWorkspaceResponse>()
    mockApiPut.mockReturnValue(request.promise)
    mockWorkspaceRead.mockReturnValue(refreshedRead.promise)
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)
    renderHook(() => useQuery({ queryKey: key, queryFn: () => mockWorkspaceRead(), staleTime: Infinity }), { wrapper })
    const { result } = renderHook(() => useReviewItemDecision("analysis-1"), { wrapper })

    act(() => result.current.decide({
      item: { itemId: "link-1", itemType: "impact" },
      action: "accept",
    }))
    await waitFor(() => expect(mockApiPut).toHaveBeenCalledTimes(1))

    expect(queryClient.getQueryData<AnalysisWorkspaceResponse>(key)?.reviewQueue[0].currentDecision)
      .toBe("needs_review")
    expect(queryClient.getQueryData<AnalysisWorkspaceResponse>(key)?.reviewSummary.reviewed).toBe(0)
    expect(queryClient.getQueryData<AnalysisWorkspaceResponse>(key)?.reportStatus.canFinalize).toBe(false)

    await act(async () => request.resolve({
      itemId: "link-1", target: "impact", currentDecision: "accepted", reviewNote: null, idempotent: false,
    }))
    await waitFor(() => expect(mockWorkspaceRead).toHaveBeenCalledTimes(1))
    expect(result.current.isPending).toBe(true)

    await act(async () => refreshedRead.resolve(acceptedWorkspace()))
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(queryClient.getQueryData<AnalysisWorkspaceResponse>(key)?.reviewQueue[0].currentDecision).toBe("accepted")
    expect(queryClient.getQueryData<AnalysisWorkspaceResponse>(key)?.reviewSummary.reviewed).toBe(1)
    expect(queryClient.getQueryData<AnalysisWorkspaceResponse>(key)?.reportStatus.canFinalize).toBe(true)
  })

  it("reuses a review command key after a failed request and rotates it after success", async () => {
    mockApiPut.mockRejectedValueOnce(new Error("network timeout"))
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)
    const { result } = renderHook(() => useReviewItemDecision("analysis-1"), { wrapper })
    const input = {
      item: { itemId: "link-1", itemType: "impact" as const },
      action: "accept" as const,
      rationale: "Reviewed source evidence",
    }

    act(() => result.current.decide(input))
    await waitFor(() => expect(mockApiPut).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.isPending).toBe(false))
    const firstRequestKey = (mockApiPut.mock.calls[0]?.[1] as { requestKey: string }).requestKey

    mockApiPut.mockResolvedValue({
      itemId: "link-1",
      target: "impact",
      currentDecision: "accepted",
      reviewNote: "Reviewed source evidence",
      idempotent: true,
    })
    act(() => result.current.decide(input))
    await waitFor(() => expect(mockApiPut).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.isPending).toBe(false))
    const retryRequestKey = (mockApiPut.mock.calls[1]?.[1] as { requestKey: string }).requestKey
    expect(retryRequestKey).toBe(firstRequestKey)

    act(() => result.current.decide(input))
    await waitFor(() => expect(mockApiPut).toHaveBeenCalledTimes(3))
    const nextCommandKey = (mockApiPut.mock.calls[2]?.[1] as { requestKey: string }).requestKey
    expect(nextCommandKey).not.toBe(firstRequestKey)
  })
})
