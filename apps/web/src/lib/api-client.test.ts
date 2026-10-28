import { apiGet } from "./api-client"
import { ApiError } from "./api-error"
import { z } from "zod"

describe("api client response contracts", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("fails closed when a JSON request is made without a response schema", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ unexpected: "shape" }),
    })
    jest.spyOn(global, "fetch").mockImplementation(fetchMock)

    const requestWithoutSchema = Reflect.apply(apiGet, undefined, ["/api/v1/example"])

    await expect(requestWithoutSchema).rejects.toMatchObject({
      code: "API_CONTRACT_MISSING",
    } satisfies Partial<ApiError>)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects a successful non-JSON response that cannot satisfy its schema", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "text/html" }),
      text: async () => "<html>wrong server</html>",
    } as Response)

    await expect(apiGet("/api/v1/example", z.object({ value: z.string() }))).rejects.toMatchObject({
      code: "API_WRONG_SERVER",
    })
  })

  it("rejects a non-JSON success even when a permissive schema accepts null", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "text/html" }),
      text: async () => "<html>wrong server</html>",
    } as Response)

    await expect(apiGet("/api/v1/example", z.unknown())).rejects.toMatchObject({
      code: "API_WRONG_SERVER",
    })
  })
})
