"use client"

import { use } from "react"
import Link from "next/link"

import { ReportViewer } from "@/components/report/report-viewer"

export default function ApprovedReportPrintPage({
  params,
}: {
  params: Promise<{ analysisId: string }>
}) {
  const { analysisId } = use(params)

  return (
    <main className="report-print-route min-h-dvh bg-surface-muted/40 py-6 print:bg-white print:py-0">
      <div className="report-print-controls mx-auto mb-4 flex w-full max-w-[210mm] items-center justify-between px-4 text-sm text-muted-foreground print:hidden">
        <Link href={`/reports?analysisId=${analysisId}`} className="hover:text-foreground">
          Back to report preview
        </Link>
        <span>Print preview uses the persisted approved report snapshot.</span>
      </div>
      <ReportViewer analysisId={analysisId} printMode />
    </main>
  )
}
