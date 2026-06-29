export function resolveNextAuthSecret(env = process.env): string {
  const secret = env.NEXTAUTH_SECRET?.trim()
  const productionLike =
    env.NODE_ENV === "production" ||
    (env.NODE_ENV as string) === "staging" ||
    env.PREVIEW_AUTH_ENABLED === "true"

  if (!secret && productionLike) {
    throw new Error(
      "NEXTAUTH_SECRET is required for production, staging, or preview-auth deployments.",
    )
  }

  return secret || "dev-super-secret-key-nextauth"
}
