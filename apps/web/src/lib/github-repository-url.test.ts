import {
  isGithubRepositoryUrl,
  parseGithubRepositoryUrl,
} from "./github-repository-url"

describe("github repository URL parsing", () => {
  it("normalizes public HTTPS GitHub repository URLs", () => {
    expect(parseGithubRepositoryUrl(" https://github.com/acme/api.git ")).toEqual({
      owner: "acme",
      repo: "api",
      fullName: "acme/api",
      canonicalUrl: "https://github.com/acme/api",
    })
  })

  it("accepts repository names with dots, underscores, and dashes", () => {
    expect(parseGithubRepositoryUrl("https://github.com/acme-inc/api_server.v2")?.fullName).toBe(
      "acme-inc/api_server.v2",
    )
  })

  it("rejects URLs that could carry credentials or non-repository paths", () => {
    expect(isGithubRepositoryUrl("https://token@github.com/acme/api")).toBe(false)
    expect(isGithubRepositoryUrl("https://github.com/acme/api?token=secret")).toBe(false)
    expect(isGithubRepositoryUrl("https://github.com/acme/api#readme")).toBe(false)
    expect(isGithubRepositoryUrl("https://github.com/acme/api/tree/main")).toBe(false)
  })

  it("rejects SSH, non-GitHub, and non-HTTPS URLs", () => {
    expect(isGithubRepositoryUrl("git@github.com:acme/api.git")).toBe(false)
    expect(isGithubRepositoryUrl("http://github.com/acme/api")).toBe(false)
    expect(isGithubRepositoryUrl("https://gitlab.com/acme/api")).toBe(false)
  })
})
