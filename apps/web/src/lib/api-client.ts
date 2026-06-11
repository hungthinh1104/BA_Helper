import { ApiError, ApiContractError } from "./api-error"
import { z } from "zod"
import { getApiBaseUrl } from "./runtime-config"
import type { UserRole } from "@ba-helper/contracts"

export { getApiBaseUrl } from "./runtime-config"

import { getSession } from "next-auth/react"

type SessionWithAccessToken = {
  accessToken?: string
  user?: {
    id?: string
    name?: string | null
    email?: string | null
    role?: UserRole
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const session = (await getSession()) as SessionWithAccessToken | null
    if (session?.accessToken) {
      return { Authorization: `Bearer ${session.accessToken}` }
    }
  } catch {
    // Ignored
  }

  return {}
}

async function requestJson<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  schema?: z.ZodType<T>,
  headers?: Record<string, string>,
): Promise<T> {
  const apiBaseUrl = getApiBaseUrl()
  let res: Response
  
  const authHeaders = await getAuthHeaders()

  try {
    res = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError({
      status: 0,
      code: "API_UNREACHABLE",
      message: `Cannot reach API at ${apiBaseUrl}.`,
      details: { apiBaseUrl, path },
    })
  }

  const contentType = res.headers.get("content-type") ?? ""
  const isJsonResponse = contentType.includes("application/json")
  const data = isJsonResponse ? await res.json().catch(() => null) : null
  const text = isJsonResponse ? null : await res.text().catch(() => "")

  if (!res.ok) {
    if (!data) {
      const respondedWithHtml =
        contentType.includes("text/html") ||
        text?.trim().toLowerCase().startsWith("<!doctype html") ||
        text?.trim().toLowerCase().startsWith("<html")

      if (respondedWithHtml) {
        throw new ApiError({
          status: res.status,
          code: "API_WRONG_SERVER",
          message: `Configured API URL responded with HTML for ${path}.`,
          details: { apiBaseUrl, contentType, path, status: res.status },
        })
      }

      throw new ApiError({
        status: res.status,
        code: "UNKNOWN_ERROR",
        message: `Request failed with status ${res.status}.`,
        details: { apiBaseUrl, contentType, path, status: res.status },
      })
    }

    let errorCode = data?.code ?? "UNKNOWN_ERROR"
    let errorMessage = data?.message ?? "Request failed"

    if (res.status === 401) {
      errorCode = "UNAUTHORIZED"
      errorMessage = "Your session expired. Please sign in again."
    } else if (res.status === 403) {
      errorCode = "FORBIDDEN"
      errorMessage = "You do not have permission to perform this action."
    }

    throw new ApiError({
      status: res.status,
      code: errorCode,
      message: errorMessage,
      details: data?.details,
    })
  }

  if (schema) {
    const parsed = schema.safeParse(data)
    if (!parsed.success) {
      const respondedWithHtml =
        contentType.includes("text/html") ||
        text?.trim().toLowerCase().startsWith("<!doctype html") ||
        text?.trim().toLowerCase().startsWith("<html")

      if (respondedWithHtml) {
        throw new ApiError({
          status: 500,
          code: "API_WRONG_SERVER",
          message: `Configured API URL responded with HTML for ${path}.`,
          details: { apiBaseUrl, contentType, path }
        })
      }
      throw new ApiContractError(parsed.error)
    }
    return parsed.data
  }

  return data as T
}

export async function apiGet<T>(path: string, schema?: z.ZodType<T>, headers?: Record<string, string>): Promise<T> {
  return requestJson("GET", path, undefined, schema, headers)
}

export async function apiPost<T>(path: string, body: unknown, schema?: z.ZodType<T>, headers?: Record<string, string>): Promise<T> {
  return requestJson("POST", path, body, schema, headers)
}

export async function apiPatch<T>(path: string, body: unknown, schema?: z.ZodType<T>, headers?: Record<string, string>): Promise<T> {
  return requestJson("PATCH", path, body, schema, headers)
}

export async function apiDelete<T>(path: string, schema?: z.ZodType<T>, headers?: Record<string, string>): Promise<T> {
  return requestJson("DELETE", path, undefined, schema, headers)
}

export async function apiGetFile(path: string): Promise<{
  blob: Blob
  filename: string
  contentType: string
}> {
  const apiBaseUrl = getApiBaseUrl()
  const authHeaders = await getAuthHeaders()

  let res: Response
  try {
    res = await fetch(`${apiBaseUrl}${path}`, {
      method: "GET",
      headers: authHeaders,
    })
  } catch {
    throw new ApiError({
      status: 0,
      code: "API_UNREACHABLE",
      message: `Cannot reach API at ${apiBaseUrl}.`,
      details: { apiBaseUrl, path },
    })
  }

  const contentType = res.headers.get("content-type") ?? ""
  const isJsonResponse = contentType.includes("application/json")
  const data = isJsonResponse ? await res.json().catch(() => null) : null

  if (!res.ok) {
    if (data) {
      throw new ApiError({
        status: res.status,
        code: data.code ?? "UNKNOWN_ERROR",
        message:
          res.status === 401
            ? "Your session expired. Please sign in again."
            : res.status === 403
              ? "You do not have permission to perform this action."
              : data.message ?? `Request failed with status ${res.status}.`,
        details: data.details,
      })
    }

    throw new ApiError({
      status: res.status,
      code: "UNKNOWN_ERROR",
      message: `Request failed with status ${res.status}.`,
      details: { apiBaseUrl, contentType, path, status: res.status },
    })
  }

  const blob = await res.blob()
  const contentDisposition = res.headers.get("Content-Disposition")
  let filename = "download.bin"
  if (contentDisposition?.includes("filename=")) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/)
    if (match?.[1]) {
      filename = match[1]
    }
  }

  return {
    blob,
    filename,
    contentType,
  }
}
