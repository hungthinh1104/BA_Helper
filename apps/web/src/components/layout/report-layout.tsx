import { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Download, Share, ChevronLeft } from "lucide-react"
import Link from "next/link"

interface ReportLayoutProps {
  children: ReactNode
  title: string
}

export function ReportLayout({ children, title }: ReportLayoutProps) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="h-14 border-b border-border bg-surface-soft flex items-center justify-between px-6 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/app/analyses/mock-analysis-123" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="font-semibold text-sm">{title}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8">
            <Share className="w-4 h-4 mr-2" /> Share
          </Button>
          <Button size="sm" className="h-8">
            <Download className="w-4 h-4 mr-2" /> Export PDF
          </Button>
        </div>
      </header>
      
      <main className="flex-1 py-10 px-4">
        <div className="max-w-4xl mx-auto bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  )
}
