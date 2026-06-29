import { ApiError } from "./api-error"


interface RuntimeEnv {
  apiUrl?: string
  internalApiUrl?: string
  nodeEnv?: string
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
}): string {
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
