import Link from "next/link"

export function AppSidebar() {
  return (
    <aside className="app-sidebar">
      <div className="flex items-center gap-2 px-2 mb-8">
        <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
          BA
        </div>
        <span className="font-semibold text-sm">Helper</span>
      </div>

      <nav className="nav-section">
        <div className="nav-label">Workspace</div>
        <Link href="/app/analyses" className="nav-item" data-active="true">
          Impact Analyses
        </Link>
        <Link href="/app/repositories" className="nav-item">
          Repositories
        </Link>
      </nav>

      <nav className="nav-section mt-8">
        <div className="nav-label">Settings</div>
        <Link href="/app/settings/profile" className="nav-item">
          Profile
        </Link>
      </nav>
    </aside>
  )
}
