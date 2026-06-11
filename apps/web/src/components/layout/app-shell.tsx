import { ReactNode } from "react"
import { AppSidebar } from "./app-sidebar"
import { AppTopbar } from "./app-topbar"

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <AppSidebar />
      <main className="app-main">
        <AppTopbar />
        {children}
      </main>
    </div>
  )
}
