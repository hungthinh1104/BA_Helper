"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useState } from "react"
import { Loader2 } from "lucide-react"

type DemoState = "idle" | "analyzing" | "results"

export function LandingHero() {
  const [demoState, setDemoState] = useState<DemoState>("idle")

  const handleAnalyzeClick = () => {
    setDemoState("analyzing")
    setTimeout(() => {
      setDemoState("results")
    }, 1000)
  }
  return (
    <section className="landing-hero border-b border-border text-center">
      <div className="hero-content">
        <div className="hero-eyebrow border border-primary/20 bg-primary/5 text-primary">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          Now available for NestJS
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground mb-6" style={{ background: "var(--hero-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Requirement-to-Code<br />Impact Analyzer
        </h1>
        <p className="hero-subtitle text-lg md:text-xl text-muted-foreground mx-auto">
          Not just another AI Copilot. We map business requirements to exact codebase artifacts with verifiable evidence—no hallucinations.
        </p>
        <div className="hero-actions">
          <Link href="/analyses/mock-analysis-123">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-md px-8 h-12">
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
            
            {demoState === "analyzing" && (
              <div className="animate-scan-line"></div>
            )}

            <div className={`absolute inset-0 bg-background/5 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-4 transition-opacity duration-300 ${demoState === 'results' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <div className="bg-surface border border-border shadow-2xl rounded-xl p-6 max-w-lg w-full mb-8 cursor-default">
                <div className="flex flex-col gap-4">
                  <div className="text-sm font-semibold text-foreground">Test the Analyzer</div>
                  <input 
                    type="text" 
                    readOnly 
                    value="Cancel paid booking and refund to wallet"
                    className="w-full bg-surface-muted border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none"
                  />
                  <Button 
                    size="lg" 
                    className="w-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg h-12 text-md"
                    onClick={handleAnalyzeClick}
                    disabled={demoState === 'analyzing'}
                  >
                    {demoState === 'analyzing' ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analyzing Repository...</>
                    ) : (
                      "Analyze Impact"
                    )}
                  </Button>
                </div>
              </div>
            </div>
            
            <div className={`mockup-sidebar border-r border-border p-4 space-y-4 transition-opacity duration-300 ${demoState === 'results' ? 'opacity-100' : 'opacity-30'}`}>
              <div className="h-6 w-24 bg-border rounded"></div>
              <div className="h-4 w-32 bg-border/50 rounded"></div>
              <div className="h-4 w-28 bg-border/50 rounded"></div>
            </div>
            
            <div className={`mockup-main p-6 space-y-4 transition-opacity duration-300 ${demoState === 'results' ? 'opacity-100' : 'opacity-30'}`}>
              <div className="h-8 w-64 bg-border rounded"></div>
              <div className="h-4 w-48 bg-border/50 rounded mb-8"></div>
              
              <div className={`h-24 w-full rounded-lg border flex flex-col justify-center px-6 transition-all duration-500 ${demoState === 'results' ? 'bg-primary/10 border-primary/30 shadow-[0_0_15px_var(--info-soft)]' : 'bg-border/30 border-border'}`}>
                {demoState === 'results' && (
                  <div className="animate-fade-in font-mono text-sm text-primary font-semibold">
                    BookingController.cancel
                  </div>
                )}
              </div>
              <div className={`h-24 w-full rounded-lg border flex flex-col justify-center px-6 transition-all duration-500 delay-150 ${demoState === 'results' ? 'bg-primary/10 border-primary/30 shadow-[0_0_15px_var(--info-soft)]' : 'bg-border/30 border-border'}`}>
                {demoState === 'results' && (
                  <div className="animate-fade-in font-mono text-sm text-primary font-semibold">
                    PaymentService.refund()
                  </div>
                )}
              </div>
            </div>
            
            <div className={`mockup-inspector border-l border-border p-4 transition-opacity duration-300 relative ${demoState === 'results' ? 'opacity-100 bg-surface' : 'opacity-30'}`}>
              {demoState === 'results' ? (
                <div className="space-y-4 mt-2">
                  <div className="animate-slide-in-right border-l-4 border-success bg-success/5 p-4 rounded-r-lg shadow-sm">
                    <div className="text-xs font-bold text-success mb-1 uppercase tracking-wider">Evidenced</div>
                    <div className="text-sm text-foreground mb-2">PaymentService.refund() is touched by the cancellation flow.</div>
                    <div className="font-mono text-[10px] text-muted-foreground bg-surface-muted p-1 rounded inline-block">src/booking/payment.service.ts:45</div>
                  </div>
                  
                  <div className="animate-slide-in-right opacity-0 border-l-4 border-warning bg-warning/5 p-4 rounded-r-lg shadow-sm" style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}>
                    <div className="text-xs font-bold text-warning mb-1 uppercase tracking-wider">Unknown</div>
                    <div className="text-sm text-foreground">Refund percentage is not confirmed from code evidence.</div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="h-6 w-32 bg-border rounded mb-4"></div>
                  <div className="h-48 w-full bg-border/40 rounded"></div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
