import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"

const mutateAsync = jest.fn<(input: unknown) => Promise<unknown>>()

jest.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
jest.mock("@/hooks/api/use-requirements", () => ({
  useCreateRequirement: () => ({ mutateAsync, isPending: false }),
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { NewRequirementDialog } = require("./new-requirement-dialog") as typeof import("./new-requirement-dialog")

describe("NewRequirementDialog submission retry", () => {
  afterEach(() => {
    cleanup()
    jest.restoreAllMocks()
  })

  beforeEach(() => {
    mutateAsync.mockReset()
    jest.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("7c05a7d3-1f87-4b91-8588-9278ec81f642")
      .mockReturnValueOnce("edfb80d5-3288-4c63-9c43-3f62d8b8fc50")
  })

  it("keeps the request key and entered form data when a failed submission is retried after reopening", async () => {
    const user = userEvent.setup()
    mutateAsync
      .mockRejectedValueOnce(new Error("temporary network failure"))
      .mockResolvedValueOnce({
        id: "requirement-1",
        revisionId: "revision-1",
        readinessStatus: "READY_FOR_ANALYSIS",
        validationIssues: [],
      })

    render(
      <NewRequirementDialog>
        <button>Open requirement dialog</button>
      </NewRequirementDialog>,
    )

    await user.click(screen.getByRole("button", { name: "Open requirement dialog" }))
    await user.type(screen.getByPlaceholderText("titlePlaceholder"), "Refund paid booking")
    await user.type(screen.getByPlaceholderText("rawTextPlaceholder"), "Cancel a paid booking and issue a refund.")
    await user.click(screen.getByRole("button", { name: "submitCheckReadiness" }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))

    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: "Open requirement dialog" }))
    expect(screen.getByPlaceholderText("titlePlaceholder")).toHaveValue("Refund paid booking")
    expect(screen.getByPlaceholderText("rawTextPlaceholder")).toHaveValue("Cancel a paid booking and issue a refund.")
    await user.click(screen.getByRole("button", { name: "submitCheckReadiness" }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2))

    const [firstRequest, retryRequest] = mutateAsync.mock.calls.map(([input]) => input as {
      requestKey: string
      title: string
      rawText: string
      submitForReadinessCheck: boolean
    })
    expect(retryRequest).toEqual(firstRequest)
    expect(retryRequest.requestKey).toBe("7c05a7d3-1f87-4b91-8588-9278ec81f642")
  })

  it("starts a new idempotency request when the user edits a failed submission", async () => {
    const user = userEvent.setup()
    mutateAsync
      .mockRejectedValueOnce(new Error("temporary network failure"))
      .mockResolvedValueOnce({
        id: "requirement-2",
        revisionId: "revision-2",
        readinessStatus: "READY_FOR_ANALYSIS",
        validationIssues: [],
      })

    render(
      <NewRequirementDialog>
        <button>Open requirement dialog</button>
      </NewRequirementDialog>,
    )

    await user.click(screen.getByRole("button", { name: "Open requirement dialog" }))
    await user.type(screen.getByPlaceholderText("titlePlaceholder"), "Refund paid booking")
    await user.type(screen.getByPlaceholderText("rawTextPlaceholder"), "Cancel a paid booking and issue a refund.")
    await user.click(screen.getByRole("button", { name: "submitCheckReadiness" }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))

    const titleInput = screen.getByPlaceholderText("titlePlaceholder")
    await user.clear(titleInput)
    await user.type(titleInput, "Refund cancelled booking")
    await user.click(screen.getByRole("button", { name: "submitCheckReadiness" }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2))

    const [firstRequest, updatedRequest] = mutateAsync.mock.calls.map(([input]) => input as {
      requestKey: string
      title: string
      rawText: string
      submitForReadinessCheck: boolean
    })
    expect(updatedRequest.title).toBe("Refund cancelled booking")
    expect(updatedRequest.requestKey).not.toBe(firstRequest.requestKey)
  })

  it("keeps the request key when an edit normalizes to the same payload", async () => {
    const user = userEvent.setup()
    mutateAsync
      .mockRejectedValueOnce(new Error("temporary network failure"))
      .mockResolvedValueOnce({
        id: "requirement-3",
        revisionId: "revision-3",
        readinessStatus: "READY_FOR_ANALYSIS",
        validationIssues: [],
      })

    render(
      <NewRequirementDialog>
        <button>Open requirement dialog</button>
      </NewRequirementDialog>,
    )

    await user.click(screen.getByRole("button", { name: "Open requirement dialog" }))
    await user.type(screen.getByPlaceholderText("titlePlaceholder"), "Refund paid booking")
    await user.type(screen.getByPlaceholderText("rawTextPlaceholder"), "Cancel a paid booking and issue a refund.")
    await user.click(screen.getByRole("button", { name: "submitCheckReadiness" }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))

    await user.type(screen.getByPlaceholderText("titlePlaceholder"), " ")
    await user.click(screen.getByRole("button", { name: "submitCheckReadiness" }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2))

    const [firstRequest, retryRequest] = mutateAsync.mock.calls.map(([input]) => input as {
      requestKey: string
      title: string
    })
    expect(retryRequest.title).toBe(firstRequest.title)
    expect(retryRequest.requestKey).toBe(firstRequest.requestKey)
  })
})
