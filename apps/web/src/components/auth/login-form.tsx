"use client"

import { type FormEvent, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Workflow } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/theme-toggle"
import { getAuthErrorMessage, normalizeAuthErrorCode } from "@/lib/auth-errors"
import { getSafeNext } from "@/lib/auth-routing"
import { useAuth } from "@/hooks/use-auth"

import type { AuthMode } from "@ba-helper/shared"

const ROLE_OPTIONS = ["ADMIN", "REVIEWER", "VIEWER"] as const

export function LoginForm({ authMode }: { authMode: AuthMode }) {
  const searchParams = useSearchParams()
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]>("ADMIN")
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const safeNext = useMemo(
    () => getSafeNext(searchParams?.get("next")),
    [searchParams],
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorCode(null)

    if (!email.trim()) {
      setErrorCode("UNAUTHORIZED")
      return
    }

    setIsSubmitting(true)
    const result = await login(email.trim(), role, safeNext)
    if (!result.ok) {
      setErrorCode(result.errorCode)
    }
    setIsSubmitting(false)
  }

  const message = errorCode
    ? getAuthErrorMessage(normalizeAuthErrorCode(errorCode))
    : null

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-surface/70 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/welcome" className="flex items-center gap-2 font-semibold text-foreground">
            <Workflow className="h-5 w-5 text-primary" />
            BA Helper
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border border-border/50 bg-surface/80 shadow-sm">
          <CardHeader className="border-b border-border/50">
            <CardTitle>Dev Sign In</CardTitle>
            <CardDescription>
              Authenticate before entering the workspace. This MVP uses dev-login only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {authMode === "unsupported" ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="mb-4 rounded-full bg-muted p-3">
                  <Workflow className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  Sign-in is not configured for this environment.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Dev login is only available in local development.
                </p>
              </div>
            ) : (
              <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground" htmlFor="email">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="analyst@ba-helper.dev"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground" htmlFor="role">
                    Role
                  </label>
                  <select
                    id="role"
                    className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={role}
                    onChange={(event) => setRole(event.target.value as (typeof ROLE_OPTIONS)[number])}
                    disabled={isSubmitting}
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                {message && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {message}
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Redirect after sign-in: <span className="font-mono">{safeNext}</span>
                </div>

                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
