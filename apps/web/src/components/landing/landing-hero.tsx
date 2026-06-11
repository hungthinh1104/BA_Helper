import { Button } from "@/components/ui/button"
import Link from "next/link"

export function LandingHero() {
  return (
    <section className="landing-hero border-b border-border text-center">
      <div className="hero-content">
        <div className="hero-eyebrow border border-primary/20 bg-primary/5 text-primary">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          Now available for NestJS
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground mb-6" style={{ background: "linear-gradient(to right, #1e3a8a, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Requirement-to-Code<br />Impact Analyzer
        </h1>
        <p className="hero-subtitle text-lg md:text-xl text-muted-foreground mx-auto">
          Upload your BA requirements. We parse your backend and highlight the exact code artifacts affected. No more guessing.
        </p>
        <div className="hero-actions">
          <Link href="/app/analyses/mock-analysis-123">
            <Button size="lg" className="bg-primary text-white hover:bg-primary/90 text-md px-8 h-12">
              Try the Demo
            </Button>
          </Link>
          <Button size="lg" variant="outline" className="text-md px-8 h-12">
            View Documentation
          </Button>
        </div>
      </div>

      <div className="hero-mockup mt-16 px-4 md:px-0">
        <div className="product-mockup bg-surface">
          <div className="product-mockup-header bg-surface-soft flex items-center p-3 border-b border-border">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-danger/70"></div>
              <div className="w-3 h-3 rounded-full bg-warning/70"></div>
              <div className="w-3 h-3 rounded-full bg-success/70"></div>
            </div>
          </div>
          <div className="product-mockup-body text-left overflow-hidden relative">
            <div className="absolute inset-0 bg-background/5 backdrop-blur-sm z-10 flex items-center justify-center">
              <Link href="/app/analyses/mock-analysis-123">
                <Button size="lg" className="shadow-lg">
                  Explore Interactive Demo
                </Button>
              </Link>
            </div>
            
            <div className="mockup-sidebar border-r border-border p-4 space-y-4 opacity-50">
              <div className="h-6 w-24 bg-border rounded"></div>
              <div className="h-4 w-32 bg-border/50 rounded"></div>
              <div className="h-4 w-28 bg-border/50 rounded"></div>
            </div>
            <div className="mockup-main p-6 space-y-4 opacity-50">
              <div className="h-8 w-64 bg-border rounded"></div>
              <div className="h-4 w-48 bg-border/50 rounded mb-8"></div>
              
              <div className="h-24 w-full bg-border/30 rounded-lg border border-border"></div>
              <div className="h-24 w-full bg-border/30 rounded-lg border border-border"></div>
            </div>
            <div className="mockup-inspector border-l border-border p-4 space-y-4 opacity-50">
              <div className="h-6 w-32 bg-border rounded"></div>
              <div className="h-48 w-full bg-border/40 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
