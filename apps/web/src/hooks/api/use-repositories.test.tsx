import type { PropsWithChildren } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, jest } from "@jest/globals"

const mockApiGet = jest.fn()
jest.mock("@/lib/api-client", () => ({ apiGet: (...args: unknown[]) => mockApiGet(...args) }))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useSnapshotDrift } = require("./use-repositories") as typeof import("./use-repositories")

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe("useSnapshotDrift", () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it("sends the target snapshot ID using the backend query parameter", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mockApiGet.mockResolvedValue({} as never)

    const { result } = renderHook(
      () => useSnapshotDrift("project-id", "repository-id", "base-snapshot-id", "target-snapshot-id"),
      { wrapper: createWrapper(client) },
    )

    await waitFor(() => expect(mockApiGet).toHaveBeenCalled())
    expect(mockApiGet.mock.calls[0][0]).toBe(
      "/api/v1/projects/project-id/repositories/repository-id/snapshots/base-snapshot-id/drift?targetSnapshotId=target-snapshot-id",
    )
    expect(result.current.isError).toBe(false)
    client.clear()
  })
})
