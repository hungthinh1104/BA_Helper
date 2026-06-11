import { ShieldCheck, Workflow, SearchCode } from "lucide-react"

export function FeatureGrid() {
  const features = [
    {
      icon: <SearchCode className="w-8 h-8 text-primary" />,
      title: "Evidence-Backed Insights",
      description: "Every impact claim is linked directly to a line of code. No more black-box AI hallucinations."
    },
    {
      icon: <Workflow className="w-8 h-8 text-primary" />,
      title: "Automated Traceability",
      description: "Generates a full Traceability Matrix between your business requirement and the extracted dependency graph."
    },
    {
      icon: <ShieldCheck className="w-8 h-8 text-primary" />,
      title: "Identify Unknowns Early",
      description: "Flags missing acceptance criteria and generates QA scenarios before a single line of code is written."
    }
  ]

  return (
    <section className="py-24 bg-surface text-center">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-foreground mb-16">Built for Technical Business Analysts</h2>
        <div className="grid md:grid-cols-3 gap-12">
          {features.map(f => (
            <div key={f.title} className="flex flex-col items-center p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                {f.icon}
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">{f.title}</h3>
              <p className="text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
