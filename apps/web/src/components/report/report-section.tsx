import { ReactNode } from "react"

interface ReportSectionProps {
  title: string
  children: ReactNode
}

export function ReportSection({ title, children }: ReportSectionProps) {
  return (
    <section className="mt-8 mb-4">
      <h2 className="text-lg font-bold border-b border-border pb-2 mb-4 text-foreground">
        {title}
      </h2>
      <div>{children}</div>
    </section>
  )
}
