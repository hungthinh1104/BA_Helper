export const AUTH_ERROR_CODES = [
  "DEV_LOGIN_DISABLED",
  "API_UNREACHABLE",
  "API_WRONG_SERVER",
  "INVALID_API_URL",
  "UNAUTHORIZED",
  "UNKNOWN_AUTH_ERROR",
] as const

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number]

export function normalizeAuthErrorCode(value: string | null | undefined): AuthErrorCode {
  if (!value) {
    return "UNKNOWN_AUTH_ERROR"
  }

  return AUTH_ERROR_CODES.includes(value as AuthErrorCode)
    ? (value as AuthErrorCode)
    : "UNKNOWN_AUTH_ERROR"
}

export function getAuthErrorMessage(code: AuthErrorCode): string {
  switch (code) {
    case "DEV_LOGIN_DISABLED":
      return "Dev login is disabled. Set ENABLE_DEV_LOGIN=true in the API environment."
    case "API_UNREACHABLE":
      return "Cannot reach the API server. Check NEXT_PUBLIC_API_URL and backend status."
    case "API_WRONG_SERVER":
      return "Configured API URL points to the wrong server. Make sure it targets the BA Helper API."
    case "INVALID_API_URL":
      return "NEXT_PUBLIC_API_URL is invalid. Fix the frontend environment configuration."
    case "UNAUTHORIZED":
      return "Sign-in was rejected. Check the email, selected role, and dev-login settings."
    default:
      return "Sign-in failed. Please try again."
  }
}
