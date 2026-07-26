import { ApiError } from "./api-error"
import { getApiBaseUrl } from "./runtime-config"

describe("runtime-config", () => {
  it("throws API_URL_MISSING when API URL is missing", () => {
    expect(() => getApiBaseUrl({ nodeEnv: "development" })).toThrow(ApiError)
    expect(() => getApiBaseUrl({ nodeEnv: "development" })).toThrow(
      "API URL is missing. Set INTERNAL_API_URL for server-side calls or NEXT_PUBLIC_API_URL for browser-visible calls.",
    )
  })

  it("prefers INTERNAL_API_URL when provided", () => {
    expect(
      getApiBaseUrl({
        apiUrl: "http://localhost:3001",
        internalApiUrl: "http://api:3001",
        nodeEnv: "production",
      }),
    ).toBe("http://api:3001")
  })

  it("requires explicit API URL in production", () => {
    expect(() => getApiBaseUrl({ nodeEnv: "production" })).toThrow(ApiError)
    expect(() => getApiBaseUrl({ nodeEnv: "production" })).toThrow(
      "API URL is missing. Set INTERNAL_API_URL for server-side calls or NEXT_PUBLIC_API_URL for browser-visible calls.",
    )
  })

  it("rejects invalid API URL values", () => {
    expect(() =>
      getApiBaseUrl({ apiUrl: "not-a-url", nodeEnv: "development" }),
    ).toThrow("NEXT_PUBLIC_API_URL is invalid")
  })

  it("uses a same-origin base in the browser and never bakes in an absolute API origin", () => {
    // Even when an absolute NEXT_PUBLIC_API_URL is present, the browser stays
    // same-origin; requests to /api/v1/* are proxied by Next rewrites.
    expect(
      getApiBaseUrl({
        apiUrl: "http://localhost:3001",
        nodeEnv: "production",
        isBrowser: true,
      }),
    ).toBe("")

    // Same-origin even with no configured API url — no throw in the browser.
    expect(getApiBaseUrl({ nodeEnv: "production", isBrowser: true })).toBe("")
  })

  it("still calls the API directly on the server via the internal URL", () => {
    expect(
      getApiBaseUrl({
        apiUrl: "http://localhost:3001",
        internalApiUrl: "http://api:3001",
        nodeEnv: "production",
        isBrowser: false,
      }),
    ).toBe("http://api:3001")
  })
})
