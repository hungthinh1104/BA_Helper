import { ApiError } from "./api-error"

const DEFAULT_DEV_API_URL = "http://localhost:3000"

interface RuntimeEnv {
  apiUrl?: string
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
  nodeEnv: process.env.NODE_ENV,
}): string {
  if (env.apiUrl?.trim()) {
    return validateApiUrl(env.apiUrl.trim())
  }

  if (env.nodeEnv === "production") {
    throw new ApiError({
      status: 500,
      code: "API_URL_MISSING",
      message: "NEXT_PUBLIC_API_URL is required for production deployments.",
    })
  }

  return DEFAULT_DEV_API_URL
}

