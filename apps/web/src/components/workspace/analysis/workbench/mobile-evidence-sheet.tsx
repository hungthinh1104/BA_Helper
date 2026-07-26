"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import type { AnalysisWorkspaceLabels } from "@/lib/i18n/analysis-labels"

export function MobileEvidenceSheet({ children, labels }: { children: ReactNode; labels: AnalysisWorkspaceLabels["reviewWorkbench"] }) {
  const [open, setOpen] = useState(false)
  return <div className="lg:hidden"><Button type="button" variant="outline" className="w-full" onClick={() => setOpen(true)}>{labels.evidence}</Button><Sheet open={open} onOpenChange={setOpen}><SheetContent side="bottom" className="h-[85dvh] overflow-y-auto p-4"><SheetTitle>{labels.sourceEvidence}</SheetTitle><div className="mt-4">{children}</div></SheetContent></Sheet></div>
}
