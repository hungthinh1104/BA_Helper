"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { requirementCreateRequestSchema, RequirementCreateResponse, RequirementDetailResponse } from "@ba-helper/contracts"
import { useCreateRequirement } from "@/hooks/api/use-requirements"
import { X, AlertCircle, CheckCircle2, FileText } from "lucide-react"
import { toast } from "sonner"

interface NewRequirementDialogProps {
  children: React.ReactNode
  existingRequirement?: RequirementDetailResponse
}

type DialogState = "form" | "result"

export function NewRequirementDialog({ children, existingRequirement }: NewRequirementDialogProps) {
  // TODO: Use existingRequirement when detail page is migrated
  const latestRev = existingRequirement 
    ? [...existingRequirement.revisions].sort((a, b) => b.versionNumber - a.versionNumber)[0] 
    : null

  const { mutateAsync: createReq, isPending: loading } = useCreateRequirement("default-project")

  const [open, setOpen] = useState(false)
  const [state, setState] = useState<DialogState>("form")
  const [title, setTitle] = useState(latestRev?.title ?? "")
  const [rawText, setRawText] = useState(latestRev?.rawText ?? "")
  const [submitForCheck, setSubmitForCheck] = useState(true)
  const [result, setResult] = useState<RequirementCreateResponse | null>(null)

  const reset = () => {
    setState("form")
    setTitle(latestRev?.title ?? "")
    setRawText(latestRev?.rawText ?? "")
    setSubmitForCheck(true)
    setResult(null)
  }

  const handleSubmit = async () => {
    try {
      const req = await createReq({
        title: title.trim(),
        rawText: rawText.trim(),
        submitForReadinessCheck: submitForCheck,
      })
      toast.success("Requirement saved successfully")
      setResult(req)
      setState("result")
    } catch (err: unknown) {
      toast.error("Failed to save requirement", {
        description: err instanceof Error ? err.message : "Please try again.",
      })
    }
  }

  const handleAccept = () => {
    setOpen(false)
    reset()
  }

  const handleClose = (v: boolean) => {
    setOpen(v)
    if (!v) reset()
  }

  const parseResult = requirementCreateRequestSchema.safeParse({
    title: title.trim(),
    rawText: rawText.trim(),
    submitForReadinessCheck: submitForCheck,
  })
  const canSubmit = parseResult.success
  const fieldErrors = !parseResult.success ? parseResult.error.flatten().fieldErrors : {}

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[15px]">
              {state === "form" 
                ? (existingRequirement ? "Edit Request (New Revision)" : "New Requirement")
                : "Readiness Check Result"}
            </DialogTitle>
            <DialogClose className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
        </DialogHeader>

        {state === "form" && (
          <div className="px-6 py-5 flex flex-col gap-5">
            {existingRequirement && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-surface-muted border border-border/50 text-[12px] text-muted-foreground leading-relaxed">
                <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                Editing creates a new revision. Existing analyses remain tied to their original revision.
              </div>
            )}

            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">Title</label>
              <input
                className={`w-full h-9 px-3 rounded-lg border bg-surface text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 transition-all ${
                  fieldErrors.title ? "border-destructive/50 focus:ring-destructive/20" : "border-border focus:ring-primary/30 focus:border-primary/50"
                }`}
                placeholder="e.g. Cancel paid booking and refund"
                value={title}
                onChange={e => setTitle(e.target.value.slice(0, 200))}
              />
              <div className="flex items-center justify-between">
                {fieldErrors.title ? (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.title[0]}
                  </p>
                ) : <span />}
                <span className={`text-[11px] font-mono ml-auto ${
                  title.length > 190 ? "text-warning" : "text-muted-foreground/50"
                }`}>{title.length}/200</span>
              </div>
            </div>

            {/* Raw Text */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">Change Request Text</label>
                <span className={`text-[11px] font-mono ${rawText.length > 4800 ? "text-destructive" : "text-muted-foreground/60"}`}>
                  {rawText.length}/5000
                </span>
              </div>
              <textarea
                className={`w-full px-3 py-2.5 rounded-lg border bg-surface text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 transition-all resize-none leading-relaxed ${
                  fieldErrors.rawText ? "border-destructive/50 focus:ring-destructive/20" : "border-border focus:ring-primary/30 focus:border-primary/50"
                }`}
                placeholder="Describe the change request in detail..."
                rows={5}
                value={rawText}
                onChange={e => setRawText(e.target.value.slice(0, 5000))}
              />
              {fieldErrors.rawText && (
                <p className="text-[11px] text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {fieldErrors.rawText[0]}
                </p>
              )}
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <Switch checked={submitForCheck} onCheckedChange={setSubmitForCheck} />
              <span className="text-[13px] text-foreground/80">Submit for readiness check</span>
            </label>

            <div className="-mx-6 px-6 py-4 border-t border-border/60 bg-surface-muted/30 flex justify-end gap-2">
              <DialogClose render={<Button variant="outline" size="sm" className="h-8 shadow-none">Cancel</Button>} />
              <Button size="sm" className="h-8 shadow-none" disabled={!canSubmit || loading} onClick={handleSubmit}>
                {loading ? "Checking..." : submitForCheck ? "Submit & Check Readiness" : "Save as Draft"}
              </Button>
            </div>
          </div>
        )}

        {state === "result" && result && (
          <div className="px-6 py-5 flex flex-col gap-5">
            <ResultBanner status={result.readinessStatus} issues={result.validationIssues} />

            <div className="flex flex-col gap-1.5 p-4 rounded-lg bg-surface border border-border/50">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Revision ID</label>
              <span className="font-mono text-[12px] text-foreground/80">{result.revisionId}</span>
            </div>

            <div className="-mx-6 px-6 py-4 mt-2 border-t border-border/60 bg-surface-muted/30 flex justify-end gap-2">
              <Button size="sm" variant="outline" className="h-8 shadow-none" onClick={reset}>
                {result.readinessStatus === "NEEDS_CLARIFICATION" ? "Edit Requirement" : "Start Over"}
              </Button>
              <Button size="sm" className="h-8 shadow-none" onClick={handleAccept}>
                {result.readinessStatus === "NEEDS_CLARIFICATION" ? "Save Anyway" : existingRequirement ? "Save Revision" : "Add to Workspace"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ReadinessStatusBadge({ status }: { status: RequirementCreateResponse["readinessStatus"] }) {
  const map: Record<RequirementCreateResponse["readinessStatus"], { label: string; className: string }> = {
    READY_FOR_ANALYSIS: { label: "Ready for Analysis", className: "bg-success/10 text-success border-success/50" },
    NEEDS_CLARIFICATION: { label: "Needs Clarification", className: "bg-destructive/10 text-destructive border-destructive/50" },
    DRAFT: { label: "Draft", className: "bg-surface-muted text-muted-foreground border-border" },
    ARCHIVED: { label: "Archived", className: "bg-surface-muted text-muted-foreground border-border" },
  }
  const { label, className } = map[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${className}`}>
      {label}
    </span>
  )
}

function ResultBanner({ status, issues }: { status: RequirementCreateResponse["readinessStatus"]; issues: string[] }) {
  if (status === "READY_FOR_ANALYSIS") {
    return (
      <div className="flex items-start gap-3 p-4 bg-success/8 border border-success/25 rounded-lg">
        <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] font-semibold text-success mb-1">Ready for Analysis</p>
          <p className="text-[12px] text-foreground/70">This requirement has clear actionable behavior and can be used to run an Impact Analysis.</p>
        </div>
      </div>
    )
  }
  if (status === "NEEDS_CLARIFICATION") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3 p-4 bg-danger/8 border border-danger/25 rounded-lg">
          <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-danger mb-1">Needs Clarification</p>
            <p className="text-[12px] text-foreground/70">This requirement cannot be analyzed until the following issues are resolved.</p>
          </div>
        </div>
        <ul className="flex flex-col gap-1.5">
          {issues.map((issue, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] text-foreground/80">
              <span className="text-danger mt-0.5">•</span> {issue}
            </li>
          ))}
        </ul>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-3 p-4 bg-surface-muted border border-border rounded-lg">
      <FileText className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
      <p className="text-[12px] text-muted-foreground">Saved as Draft. Submit for readiness check when ready.</p>
    </div>
  )
}

export { ReadinessStatusBadge }
