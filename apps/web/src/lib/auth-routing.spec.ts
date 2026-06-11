import {
  buildLoginRedirect,
  getSafeNext,
  isProtectedAppPath,
  isPublicWebPath,
} from "./auth-routing"

describe("auth-routing", () => {
  it("recognizes public paths", () => {
    expect(isPublicWebPath("/login")).toBe(true)
    expect(isPublicWebPath("/welcome")).toBe(true)
    expect(isPublicWebPath("/api/auth/session")).toBe(true)
    expect(isPublicWebPath("/_next/static/chunk.js")).toBe(true)
    expect(isPublicWebPath("/logo.svg")).toBe(true)
  })

  it("recognizes protected app paths", () => {
    expect(isProtectedAppPath("/")).toBe(true)
    expect(isProtectedAppPath("/repositories")).toBe(true)
    expect(isProtectedAppPath("/analyses/123")).toBe(true)
    expect(isProtectedAppPath("/reports")).toBe(true)
    expect(isProtectedAppPath("/welcome")).toBe(false)
  })

  it("sanitizes unsafe next targets", () => {
    expect(getSafeNext("/repositories")).toBe("/repositories")
    expect(getSafeNext("/analyses/abc?tab=review")).toBe("/analyses/abc?tab=review")
    expect(getSafeNext("https://evil.com")).toBe("/")
    expect(getSafeNext("//evil.com")).toBe("/")
    expect(getSafeNext("/login")).toBe("/")
    expect(getSafeNext("/api/auth")).toBe("/")
    expect(getSafeNext("/api/auth/signin")).toBe("/")
    expect(getSafeNext(undefined)).toBe("/")
  })

  it("builds login redirects with safe next params", () => {
    expect(buildLoginRedirect("/repositories", "")).toBe("/login?next=%2Frepositories")
    expect(buildLoginRedirect("/analyses/abc", "?tab=insights")).toBe(
      "/login?next=%2Fanalyses%2Fabc%3Ftab%3Dinsights",
    )
  })
})
