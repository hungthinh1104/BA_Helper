import type { AuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { ZodError } from "zod"
import {
  loginResponseSchema,
  userRoleSchema,
  type UserRole,
} from "@ba-helper/contracts"
import { ApiError } from "@/lib/api-error"
import { normalizeAuthErrorCode } from "@/lib/auth-errors"
import { getApiBaseUrl } from "@/lib/runtime-config"

type AuthorizedUser = {
  id: string
  name: string | null
  email: string
  role: UserRole
  accessToken: string
}

type TokenWithAuth = {
  id?: string
  role?: UserRole
  accessToken?: string
}

type SessionWithAuth = {
  user?: {
    id?: string
    name?: string | null
    email?: string | null
    role?: UserRole
  }
  accessToken?: string
}

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        role: { label: "Role", type: "text" },
      },
      async authorize(credentials): Promise<AuthorizedUser | null> {
        if (!credentials?.email) {
          throw new Error("UNAUTHORIZED")
        }

        try {
          const parsedRole = userRoleSchema.safeParse(credentials.role)
          if (!parsedRole.success) {
            throw new Error("UNAUTHORIZED")
          }

          const apiBaseUrl = getApiBaseUrl({
            apiUrl: process.env.NEXT_PUBLIC_API_URL,
            internalApiUrl: process.env.INTERNAL_API_URL,
            nodeEnv: process.env.NODE_ENV,
          })

          const res = await fetch(`${apiBaseUrl}/api/v1/auth/dev-login`, {
            method: "POST",
            body: JSON.stringify({ email: credentials.email, role: parsedRole.data }),
            headers: { "Content-Type": "application/json" },
          })

          if (!res.ok) {
            const contentType = res.headers.get("content-type") ?? ""
            const isJsonResponse = contentType.includes("application/json")
            const data = isJsonResponse ? await res.json().catch(() => null) : null
            const text = isJsonResponse ? null : await res.text().catch(() => "")
            const isHtml =
              contentType.includes("text/html") ||
              text?.trim().toLowerCase().startsWith("<!doctype html") ||
              text?.trim().toLowerCase().startsWith("<html")

            if (res.status === 403 && data?.message === "Dev login is disabled") {
              throw new Error("DEV_LOGIN_DISABLED")
            }

            if (isHtml) {
              throw new Error("API_WRONG_SERVER")
            }

            throw new Error(res.status === 401 ? "UNAUTHORIZED" : "UNKNOWN_AUTH_ERROR")
          }

          const data = loginResponseSchema.parse(await res.json())
          return {
            id: data.user.id,
            name: data.user.name ?? null,
            email: data.user.email,
            role: data.user.role,
            accessToken: data.accessToken,
          }
        } catch (error) {
          if (error instanceof ApiError) {
            throw new Error(error.code)
          }

          if (error instanceof ZodError) {
            throw new Error("UNKNOWN_AUTH_ERROR")
          }

          if (error instanceof Error && normalizeAuthErrorCode(error.message) !== "UNKNOWN_AUTH_ERROR") {
            throw error
          }

          if (error instanceof TypeError) {
            throw new Error("API_UNREACHABLE")
          }

          console.error("Login error:", error)
          throw new Error("UNKNOWN_AUTH_ERROR")
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authorizedUser = user as AuthorizedUser
        const authToken = token as typeof token & TokenWithAuth
        authToken.id = authorizedUser.id
        authToken.role = authorizedUser.role
        authToken.accessToken = authorizedUser.accessToken
      }
      return token
    },
    async session({ session, token }) {
      const authToken = token as typeof token & TokenWithAuth
      const authSession = session as typeof session & SessionWithAuth
      if (authSession.user) {
        authSession.user.id = authToken.id
        authSession.user.role = authToken.role
        authSession.accessToken = authToken.accessToken
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET || "dev-super-secret-key-nextauth",
}
