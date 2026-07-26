import { ApiError } from "./api-error"


interface RuntimeEnv {
  apiUrl?: string
  internalApiUrl?: string
  nodeEnv?: string
  isBrowser?: boolean
}

function validateApiUrl(value: string): string {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new ApiError({
      status: 500,
      code: "INVALID_API_URL",
      message: `NEXT_PUBLIC_API_URL is invalid: ${value}`,
    })
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ApiError({
      status: 500,
      code: "INVALID_API_URL",
      message: `NEXT_PUBLIC_API_URL must use http or https: ${value}`,
    })
  }

  parsed.hash = ""
  parsed.search = ""
  return parsed.toString().replace(/\/$/, "")
}

export function getApiBaseUrl(env: RuntimeEnv = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  internalApiUrl:
    typeof window === "undefined" ? process.env.INTERNAL_API_URL : undefined,
  nodeEnv: process.env.NODE_ENV,
  isBrowser: typeof window !== "undefined",
}): string {
  // Browser: use a same-origin base ("") so requests go to `/api/v1/*` on the web
  // origin and are proxied to the API by Next rewrites (next.config.ts). No API
  // origin is baked into the client bundle, which removes the build-time
  // NEXT_PUBLIC_API_URL inlining hazard.
  if (env.isBrowser) {
    return ""
  }

  // Server-side (SSR / server actions / NextAuth): call the API directly.
  if (env.internalApiUrl?.trim()) {
    return validateApiUrl(env.internalApiUrl.trim())
  }

  if (env.apiUrl?.trim()) {
    return validateApiUrl(env.apiUrl.trim())
  }

  throw new ApiError({
    status: 500,
    code: "API_URL_MISSING",
    message: "API URL is missing. Set INTERNAL_API_URL for server-side calls or NEXT_PUBLIC_API_URL for browser-visible calls.",
  })
}
