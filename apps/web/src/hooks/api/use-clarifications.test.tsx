import type { PropsWithChildren } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, jest } from "@jest/globals"
import { queryKeys } from "@/lib/api/query-keys"

const mockApiPost = jest.fn()
jest.mock("@/lib/api-client", () => ({ apiPost: (...args: unknown[]) => mockApiPost(...args) }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useConvertClarification } = require("./use-clarifications") as typeof import("./use-clarifications")

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe("useConvertClarification", () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it("invalidates requirement list and detail caches after creating a revision", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const requirementId = "11111111-1111-4111-8111-111111111111"
    const analysisId = "22222222-2222-4222-8222-222222222222"
    client.setQueryData(queryKeys.requirements.list("project-id"), { items: [] })
    client.setQueryData(queryKeys.requirements.detail(requirementId), { id: requirementId })
    client.setQueryData(["clarifications", "list", analysisId], { items: [] })
    mockApiPost.mockResolvedValue({
      clarificationId: "33333333-3333-4333-8333-333333333333",
      revisionId: "44444444-4444-4444-8444-444444444444",
      requirementId,
      status: "CONVERTED_TO_REVISION",
    } as never)

    const { result } = renderHook(() => useConvertClarification(analysisId), {
      wrapper: createWrapper(client),
    })

    await act(async () => {
      await result.current.mutateAsync("33333333-3333-4333-8333-333333333333")
    })

    expect(client.getQueryState(queryKeys.requirements.list("project-id"))?.isInvalidated).toBe(true)
    expect(client.getQueryState(queryKeys.requirements.detail(requirementId))?.isInvalidated).toBe(true)
    expect(client.getQueryState(["clarifications", "list", analysisId])?.isInvalidated).toBe(true)
    client.clear()
  })
})
