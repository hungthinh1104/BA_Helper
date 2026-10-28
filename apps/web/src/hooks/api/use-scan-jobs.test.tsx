import type { PropsWithChildren } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, jest } from "@jest/globals"
import { queryKeys } from "@/lib/api/query-keys"

const mockApiPost = jest.fn()
jest.mock("@/lib/api-client", () => ({ apiPost: (...args: unknown[]) => mockApiPost(...args) }))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useCreateScanJob } = require("./use-scan-jobs") as typeof import("./use-scan-jobs")

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe("useCreateScanJob", () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it("posts the contract body and invalidates the selected repository detail", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const repositoryId = "11111111-1111-4111-8111-111111111111"
    const requestKey = "22222222-2222-4222-8222-222222222222"
    const projectKey = "__workspace-pending__"
    client.setQueryData(queryKeys.repositories.detail(repositoryId), { id: repositoryId })
    client.setQueryData(queryKeys.repositories.list(projectKey), { items: [] })
    mockApiPost.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      status: "QUEUED",
      stage: "WAITING",
      progress: 0,
      error: null,
      result: { sourceTargetId: null, snapshotId: null, snapshotCoverageStatus: null },
      capabilities: { canCancel: true, canRerun: false },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as never)

    const { result } = renderHook(() => useCreateScanJob(undefined), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await result.current.mutateAsync({ repositoryId, requestKey, ref: "main" })
    })

    expect(mockApiPost).toHaveBeenCalledWith(
      `/api/v1/repositories/${repositoryId}/scan-jobs`,
      { requestKey, ref: "main" },
      expect.anything(),
    )
    expect(client.getQueryState(queryKeys.repositories.detail(repositoryId))?.isInvalidated).toBe(true)
    expect(client.getQueryState(queryKeys.repositories.list(projectKey))?.isInvalidated).toBe(true)
    client.clear()
  })
})
