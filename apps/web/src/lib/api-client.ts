import { ApiError } from "./api-error"
import { z } from "zod"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

export async function apiGet<T>(path: string, schema?: z.ZodType<T>): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 
      "Content-Type": "application/json",
      // "Authorization": token ? `Bearer ${token}` : undefined // future MVP auth
    },
  })

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new ApiError({
      status: res.status,
      code: data?.code ?? "UNKNOWN_ERROR",
      message: data?.message ?? "Request failed",
      details: data?.details,
    })
  }

  if (schema) {
    const parsed = schema.safeParse(data)
    if (!parsed.success) {
      throw new ApiError({
        status: 500,
        code: "API_CONTRACT_MISMATCH",
        message: "Backend response did not match the frontend contract.",
        details: parsed.error.flatten(),
      })
    }
    return parsed.data
  }

  return data as T
}

export async function apiPost<T>(path: string, body: unknown, schema?: z.ZodType<T>): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      // "Authorization": token ? `Bearer ${token}` : undefined // future MVP auth
    },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new ApiError({
      status: res.status,
      code: data?.code ?? "UNKNOWN_ERROR",
      message: data?.message ?? "Request failed",
      details: data?.details,
    })
  }

  if (schema) {
    const parsed = schema.safeParse(data)
    if (!parsed.success) {
      throw new ApiError({
        status: 500,
        code: "API_CONTRACT_MISMATCH",
        message: "Backend response did not match the frontend contract.",
        details: parsed.error.flatten(),
      })
    }
    return parsed.data
  }

  return data as T
}
