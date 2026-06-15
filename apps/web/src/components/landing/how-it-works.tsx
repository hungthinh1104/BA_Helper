import { SearchCode, GitMerge, FileCheck2 } from "lucide-react"

export function HowItWorks() {
  const steps = [
    {
      icon: <SearchCode className="w-8 h-8 text-primary" />,
      title: "1. Connect & Index",
      description: "Connect your TypeScript repository. BA Helper automatically parses the AST and builds a dependency graph of your core business logic.",
    },
    {
      icon: <GitMerge className="w-8 h-8 text-primary" />,
      title: "2. Analyze Impact",
      description: "Submit a change request. The backend combines scanner evidence, retrieval signals, and bounded AI output to propose affected files, APIs, and functions for review.",
    },
    {
      icon: <FileCheck2 className="w-8 h-8 text-primary" />,
      title: "3. Review Evidence",
      description: "Review generated insights directly against codebase evidence. Confirm or reject impacts to finalize the requirements and QA scenarios.",
    }
  ]

  return (
    <section className="py-24 bg-surface-muted/50 border-t border-border/50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-4">How it works</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            From raw repository to verifiable requirement impacts in three simple steps.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connector Line (Desktop) */}
          <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-[2px] bg-border/40 z-0"></div>

          {steps.map((step, idx) => (
            <div key={idx} className="relative z-10 flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-surface border-4 border-background shadow-sm flex items-center justify-center mb-6">
                {step.icon}
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
