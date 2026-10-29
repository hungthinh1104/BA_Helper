import { signIn } from "next-auth/react"
import type { LoginRequest } from "@ba-helper/contracts"
import { normalizeAuthErrorCode, type AuthErrorCode } from "@/lib/auth-errors"

export type LoginResult =
  | { ok: true }
  | { ok: false; errorCode: AuthErrorCode }

export async function loginWithCredentials(
  credentials: LoginRequest,
  next = "/",
): Promise<LoginResult> {
  const result = await signIn("credentials", {
    email: credentials.email,
    password: credentials.password,
    redirect: false,
    callbackUrl: next,
  })

  if (!result || result.error) {
    return {
      ok: false,
      errorCode: normalizeAuthErrorCode(result?.error),
    }
  }

  window.location.assign(result.url || next)
  return { ok: true }
}
