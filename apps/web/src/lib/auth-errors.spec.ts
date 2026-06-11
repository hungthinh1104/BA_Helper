import { getAuthErrorMessage, normalizeAuthErrorCode } from "./auth-errors"

describe("auth-errors", () => {
  it("normalizes supported auth error codes", () => {
    expect(normalizeAuthErrorCode("DEV_LOGIN_DISABLED")).toBe("DEV_LOGIN_DISABLED")
    expect(normalizeAuthErrorCode("INVALID_API_URL")).toBe("INVALID_API_URL")
    expect(normalizeAuthErrorCode("random")).toBe("UNKNOWN_AUTH_ERROR")
    expect(normalizeAuthErrorCode(undefined)).toBe("UNKNOWN_AUTH_ERROR")
  })

  it("returns explicit login messages", () => {
    expect(getAuthErrorMessage("DEV_LOGIN_DISABLED")).toContain("ENABLE_DEV_LOGIN=true")
    expect(getAuthErrorMessage("API_UNREACHABLE")).toContain("Cannot reach the API server")
    expect(getAuthErrorMessage("UNKNOWN_AUTH_ERROR")).toContain("Sign-in failed")
  })
})
