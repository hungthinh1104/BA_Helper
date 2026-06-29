import { Suspense } from "react"
import { LoginForm } from "@/components/auth/login-form"
import { resolveAuthMode } from "@ba-helper/shared"

export default function LoginPage() {
  const authMode = resolveAuthMode(process.env)
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginForm authMode={authMode} />
    </Suspense>
  )
}
