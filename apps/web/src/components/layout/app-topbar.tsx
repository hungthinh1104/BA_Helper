import { Button } from "@/components/ui/button"

export function AppTopbar() {
  return (
    <header className="app-topbar">
      <div className="flex items-center gap-4">
        {/* Breadcrumb or context can go here */}
        <span className="text-sm font-medium">Impact Analysis</span>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-8">Share</Button>
        <Button size="sm" className="h-8">Export Report</Button>
      </div>
    </header>
  )
}
