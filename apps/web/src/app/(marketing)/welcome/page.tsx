import { LandingHero } from "@/components/landing/landing-hero"
import { FeatureGrid } from "@/components/landing/feature-grid"
import { HowItWorks } from "@/components/landing/how-it-works"
import { CtaBanner } from "@/components/landing/cta-banner"
import { ThemeToggle } from "@/components/theme-toggle"
import Link from "next/link"
import { Workflow } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="landing-page min-h-screen">
      <header className="landing-nav bg-surface/70 backdrop-blur-md sticky top-0 z-50 border-b border-border/40">
        <div className="max-w-6xl mx-auto px-4 landing-nav-inner flex items-center justify-between h-16">
          <div className="font-bold text-lg text-foreground flex items-center gap-2">
            <Workflow className="w-5 h-5 text-primary" />
            BA Helper
          </div>
          <div className="landing-nav-links flex items-center gap-6">
            <ThemeToggle />
            <Link href="https://github.com/hungthinh1104/BA_Helper" target="_blank" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">GitHub</Link>
            <Link href="/login?next=/analyses" className="text-sm font-medium bg-foreground text-background px-4 py-2 rounded-full hover:bg-foreground/90 transition-colors">Enter Workspace</Link>
          </div>
        </div>
      </header>

      <main>
        <LandingHero />
        <FeatureGrid />
        <HowItWorks />
        <CtaBanner />
      </main>

      <footer className="border-t border-border bg-surface py-12">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-4 gap-8">
          <div className="col-span-2">
            <div className="font-bold text-lg text-foreground flex items-center gap-2 mb-4">
              <Workflow className="w-5 h-5 text-primary" />
              BA Helper
            </div>
            <p className="text-sm text-muted-foreground max-w-sm">
              The first Requirement-to-Code Impact Analyzer for Technical BAs. Build better products with verifiable codebase evidence.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-foreground">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/login?next=/analyses" className="hover:text-primary">Impact Analysis</Link></li>
              <li><Link href="/login?next=/repositories" className="hover:text-primary">Repository Snapshots</Link></li>
              <li><Link href="/login?next=/reports" className="hover:text-primary">Traceability Reports</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-foreground">Open Source</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="https://github.com/hungthinh1104/BA_Helper" target="_blank" className="hover:text-primary">GitHub Repository</Link></li>
              <li><Link href="https://github.com/hungthinh1104/BA_Helper/blob/main/README.md" target="_blank" className="hover:text-primary">Documentation</Link></li>
              <li><Link href="https://github.com/hungthinh1104/BA_Helper/blob/main/AGENTS.md" target="_blank" className="hover:text-primary">Agent Rules</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 mt-12 pt-8 border-t border-border/50 text-sm text-muted-foreground text-center">
          <p>© {new Date().getFullYear()} BA Helper. MVP Prototype.</p>
        </div>
      </footer>
    </div>
  )
}
