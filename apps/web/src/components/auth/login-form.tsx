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

export function LoginForm() {
  const searchParams = useSearchParams()
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const safeNext = useMemo(
    () => getSafeNext(searchParams?.get("next")),
    [searchParams],
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorCode(null)

    if (!email.trim() || !password) {
      setErrorCode("UNAUTHORIZED")
      return
    }

    setIsSubmitting(true)
    const result = await login({ email: email.trim(), password }, safeNext)
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
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Authenticate before entering the workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                <label className="text-sm font-medium text-foreground" htmlFor="password">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isSubmitting}
                />
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
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
