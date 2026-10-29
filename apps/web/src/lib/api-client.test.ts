import { apiGet, apiGetFile } from "./api-client"
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

  it("maps the standard NestJS forbidden envelope to the frontend permission error", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        statusCode: 403,
        message: "Project role 'VIEWER' does not allow 'repository:manage'.",
        error: "Forbidden",
      }),
    } as Response)

    await expect(apiGet("/api/v1/projects/project-id/repositories", z.unknown()))
      .rejects.toMatchObject({
        status: 403,
        code: "FORBIDDEN",
        message: "You do not have permission to perform this action.",
      })
  })

  it("preserves a valid AppError envelope and its structured details", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 409,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        code: "ANALYSIS_STALE",
        message: "Analysis was stale when finalization was requested.",
        details: { expectedCommitSha: "abc123", observedCommitSha: "def456" },
      }),
    } as Response)

    await expect(apiGet("/api/v1/impact-analyses/analysis-id/finalize", z.unknown()))
      .rejects.toMatchObject({
        status: 409,
        code: "ANALYSIS_STALE",
        message: "Analysis was stale when finalization was requested.",
        details: { expectedCommitSha: "abc123", observedCommitSha: "def456" },
      })
  })

  it("falls back safely when a JSON error envelope has invalid field types", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ code: { leaked: "bad type" }, message: ["bad", 2] }),
    } as Response)

    await expect(apiGet("/api/v1/example", z.unknown()))
      .rejects.toMatchObject({
        status: 400,
        code: "UNKNOWN_ERROR",
        message: "Request failed with status 400.",
      })
  })

  it("rejects an HTML success response instead of downloading it as a PDF", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        "content-type": "text/html; charset=utf-8",
        "content-disposition": 'attachment; filename="report.pdf"',
      }),
      blob: async () => new Blob(["<html>wrong server</html>"]),
    } as Response)

    await expect(apiGetFile(
      "/api/v1/impact-analyses/analysis-id/approved-report/export.pdf",
      "application/pdf",
    ))
      .rejects.toMatchObject({ code: "API_WRONG_SERVER" })
  })

  it("accepts the declared PDF and Markdown export media types", async () => {
    jest.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "application/pdf",
          "content-disposition": 'attachment; filename="approved-report.pdf"',
        }),
        blob: async () => new Blob(["pdf"]),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "text/markdown; charset=utf-8",
          "content-disposition": 'attachment; filename="approved-report.md"',
        }),
        blob: async () => new Blob(["# report"]),
      } as Response)

    await expect(apiGetFile("/export.pdf", "application/pdf"))
      .resolves.toMatchObject({ contentType: "application/pdf", filename: "approved-report.pdf" })
    await expect(apiGetFile("/export.md", "text/markdown"))
      .resolves.toMatchObject({ contentType: "text/markdown; charset=utf-8", filename: "approved-report.md" })
  })

  it("rejects a successful export without an attachment filename", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/pdf" }),
      blob: async () => new Blob(["pdf"]),
    } as Response)

    await expect(apiGetFile("/export.pdf", "application/pdf"))
      .rejects.toMatchObject({ code: "API_INVALID_RESPONSE" })
  })

  it("rejects an attachment filename that does not match the requested format", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="approved-report.md"',
      }),
      blob: async () => new Blob(["pdf"]),
    } as Response)

    await expect(apiGetFile("/export.pdf", "application/pdf"))
      .rejects.toMatchObject({ code: "API_INVALID_RESPONSE" })
  })
})
