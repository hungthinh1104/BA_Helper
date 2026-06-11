import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function CtaBanner() {
  return (
    <section className="py-24 border-t border-border/50 relative overflow-hidden">
      <div className="absolute inset-0 bg-primary/5 pointer-events-none"></div>
      
      {/* Decorative gradient blur */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/20 blur-[120px] rounded-full pointer-events-none"></div>
      
      <div className="max-w-4xl mx-auto px-4 relative z-10 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6 tracking-tight">
          Ready to bridge the gap between requirements and code?
        </h2>
        <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
          Stop guessing the impact of new features. Let BA Helper automatically map your business logic to technical implementation and generate verifiable evidence.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link 
            href="/app/analyses/mock-analysis-123" 
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-foreground text-background font-semibold rounded-full hover:bg-foreground/90 transition-all hover:scale-105 active:scale-95"
          >
            Try the Interactive Demo
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link 
            href="https://github.com/diphungthinh/BA_helper_test" 
            target="_blank"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-surface border border-border text-foreground font-semibold rounded-full hover:bg-surface-muted transition-all"
          >
            View GitHub
          </Link>
        </div>
      </div>
    </section>
  )
}
