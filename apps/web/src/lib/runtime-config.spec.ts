import { ApiError } from "./api-error"
import { getApiBaseUrl } from "./runtime-config"

describe("runtime-config", () => {
  it("uses localhost fallback in non-production env when API URL is missing", () => {
    expect(getApiBaseUrl({ nodeEnv: "development" })).toBe("http://localhost:3000")
  })

  it("requires explicit API URL in production", () => {
    expect(() => getApiBaseUrl({ nodeEnv: "production" })).toThrow(ApiError)
    expect(() => getApiBaseUrl({ nodeEnv: "production" })).toThrow(
      "NEXT_PUBLIC_API_URL is required",
    )
  })

  it("rejects invalid API URL values", () => {
    expect(() =>
      getApiBaseUrl({ apiUrl: "not-a-url", nodeEnv: "development" }),
    ).toThrow("NEXT_PUBLIC_API_URL is invalid")
  })
})

