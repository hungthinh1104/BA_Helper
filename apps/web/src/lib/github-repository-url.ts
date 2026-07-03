export interface ParsedGithubRepositoryUrl {
  owner: string
  repo: string
  fullName: string
  canonicalUrl: string
}

const GITHUB_OWNER_RE = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i
const GITHUB_REPO_RE = /^[a-z\d._-]+$/i

export function parseGithubRepositoryUrl(input: string): ParsedGithubRepositoryUrl | null {
  const trimmed = input.trim()

  if (!trimmed) {
    return null
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname.toLowerCase() !== "github.com" ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    return null
  }

  const segments = parsed.pathname.split("/").filter(Boolean)
  if (segments.length !== 2) {
    return null
  }

  const [owner, rawRepo] = segments
  const repo = rawRepo.endsWith(".git") ? rawRepo.slice(0, -4) : rawRepo

  if (!GITHUB_OWNER_RE.test(owner) || !repo || !GITHUB_REPO_RE.test(repo)) {
    return null
  }

  return {
    owner,
    repo,
    fullName: `${owner}/${repo}`,
    canonicalUrl: `https://github.com/${owner}/${repo}`,
  }
}

export function isGithubRepositoryUrl(input: string): boolean {
  return parseGithubRepositoryUrl(input) !== null
}
