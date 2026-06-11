import { LandingHero } from "@/components/landing/landing-hero"
import { FeatureGrid } from "@/components/landing/feature-grid"
import Link from "next/link"

export default function LandingPage() {
  return (
    <div className="landing-page min-h-screen">
      <header className="landing-nav">
        <div className="max-w-6xl mx-auto px-4 landing-nav-inner">
          <div className="font-bold text-lg text-foreground">BA Helper</div>
          <div className="landing-nav-links">
            <Link href="/app/analyses/mock-analysis-123">Try Demo</Link>
            <Link href="https://github.com/diphungthinh/BA_helper_test" target="_blank">GitHub</Link>
          </div>
        </div>
      </header>

      <main>
        <LandingHero />
        <FeatureGrid />
      </main>

      <footer className="border-t border-border bg-surface text-center py-8 text-sm text-muted-foreground">
        <p>BA Helper © {new Date().getFullYear()}. Open source MVP.</p>
      </footer>
    </div>
  )
}
