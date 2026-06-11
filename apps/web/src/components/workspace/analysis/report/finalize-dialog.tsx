"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, AlertTriangle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

interface FinalizeSummary {
  total: number
  confirmed: number
  rejected: number
  unreviewed: number
}

interface FinalizeDialogProps {
  summary: FinalizeSummary
  onFinalize: (acknowledgeUnreviewed: boolean) => Promise<void>
  children: React.ReactNode
}

export function FinalizeDialog({ summary, onFinalize, children }: FinalizeDialogProps) {
  const [open, setOpen] = useState(false)
  const [acknowledge, setAcknowledge] = useState(false)
  const [loading, setLoading] = useState(false)

  const needsAcknowledge = summary.unreviewed > 0
  const canFinalize = !needsAcknowledge || acknowledge

  const reset = () => {
    setAcknowledge(false)
  }

  const handleFinalize = async () => {
    setLoading(true)
    try {
      await onFinalize(acknowledge)
      toast.success("Analysis finalized", {
        description: "The approved impact report is now available for export.",
      })
      setOpen(false)
      reset()
    } catch (err) {
      toast.error("Finalization failed", {
        description: err instanceof Error ? err.message : "Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-md p-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[15px]">Finalize Analysis</DialogTitle>
            <DialogClose className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Review summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center gap-1 p-3 rounded-lg border border-success/25 bg-success/8">
              <span className="text-xl font-bold text-success">{summary.confirmed}</span>
              <span className="text-[11px] text-success/80 font-medium">Confirmed</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 rounded-lg border border-danger/25 bg-danger/8">
              <span className="text-xl font-bold text-danger">{summary.rejected}</span>
              <span className="text-[11px] text-danger/80 font-medium">Rejected</span>
            </div>
            <div className={`flex flex-col items-center gap-1 p-3 rounded-lg border ${
              summary.unreviewed > 0 ? "border-warning/25 bg-warning/8" : "border-border/60 bg-surface-muted/30"
            }`}>
              <span className={`text-xl font-bold ${summary.unreviewed > 0 ? "text-warning" : "text-muted-foreground"}`}>
                {summary.unreviewed}
              </span>
              <span className={`text-[11px] font-medium ${summary.unreviewed > 0 ? "text-warning/80" : "text-muted-foreground"}`}>
                Unreviewed
              </span>
            </div>
          </div>

          {/* What happens */}
          <div className="flex flex-col gap-2 p-4 bg-surface-muted/50 border border-border/60 rounded-lg">
            <p className="text-[12px] font-semibold text-foreground">What will happen:</p>
            <ul className="flex flex-col gap-1.5 text-[12px] text-foreground/70">
              <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" /> Analysis status → <strong>COMPLETED</strong></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" /> Confirmed insights become approved facts in the report</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" /> Rejected insights are excluded from approved output</li>
              {summary.unreviewed > 0 && (
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                  <span>Unreviewed insights remain labeled but are <em>not</em> presented as approved facts</span>
                </li>
              )}
            </ul>
          </div>

          {/* Acknowledge unreviewed */}
          {needsAcknowledge && (
            <label className="flex items-start gap-3 p-4 bg-warning/8 border border-warning/25 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledge}
                onChange={e => setAcknowledge(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-warning accent-warning shrink-0"
              />
              <span className="text-[12px] text-foreground/80 leading-relaxed">
                I acknowledge that <strong className="text-warning">{summary.unreviewed} insight{summary.unreviewed > 1 ? "s" : ""}</strong> remain unreviewed and will be labeled as such in the final report, not treated as approved facts.
              </span>
            </label>
          )}

          <div className="-mx-6 px-6 py-4 border-t border-border/60 bg-surface-muted/30 flex justify-end gap-2">
            <DialogClose render={<Button variant="outline" size="sm" className="h-8 shadow-none">Cancel</Button>} />
            <Button
              size="sm"
              className="h-8 shadow-none"
              disabled={!canFinalize || loading}
              onClick={handleFinalize}
            >
              {loading ? "Finalizing..." : "Finalize Analysis"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
