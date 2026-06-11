const PROTECTED_PREFIXES = [
  "/repositories",
  "/requirements",
  "/analyses",
  "/reports",
  "/settings",
]

const PUBLIC_PREFIXES = ["/api/auth", "/_next"]

const PUBLIC_EXACT_PATHS = ["/login", "/welcome", "/favicon.ico"]

const STATIC_FILE_RE = /\.[^/]+$/

export function isPublicWebPath(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.includes(pathname)) {
    return true
  }

  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true
  }

  return STATIC_FILE_RE.test(pathname)
}

export function isProtectedAppPath(pathname: string): boolean {
  if (pathname === "/") {
    return true
  }

  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function getSafeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) {
    return "/"
  }

  if (
    value.startsWith("//") ||
    value.startsWith("/\\") ||
    value.startsWith("/login") ||
    value.startsWith("/api/auth")
  ) {
    return "/"
  }

  return value
}

export function buildLoginRedirect(pathname: string, search: string): string {
  const next = getSafeNext(`${pathname}${search}`)
  return next === "/"
    ? "/login"
    : `/login?next=${encodeURIComponent(next)}`
}
