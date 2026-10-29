import { ReactNode } from "react"
import { AuthProvider } from "@/components/auth/AuthProvider"
import { AppShell } from "@/components/layout/app-shell"
import { ProjectProvider } from "@/lib/project-context"

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProjectProvider>
        <AppShell>
          {children}
        </AppShell>
      </ProjectProvider>
    </AuthProvider>
  )
}
