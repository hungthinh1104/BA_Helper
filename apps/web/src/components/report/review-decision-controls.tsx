import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { useUpdateTraceabilityReviewDecision, useDeleteTraceabilityReviewDecision } from "@/hooks/api/use-traceability"
import { traceabilityReviewDecisionValueSchema } from "@ba-helper/contracts"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { useCurrentWorkspace } from "@/lib/project-context"
import { canReview as canReviewPermission } from "@/lib/permissions"

type DecisionValue = z.infer<typeof traceabilityReviewDecisionValueSchema>

interface ReviewDecisionControlsProps {
  analysisId: string
  linkId: string
  currentDecision?: {
    decision: DecisionValue
    note?: string | null
  } | null
  isReadOnly?: boolean
}

export function ReviewDecisionControls({ analysisId, linkId, currentDecision, isReadOnly = false }: ReviewDecisionControlsProps) {
  const t = useTranslations("reports")
  const workspace = useCurrentWorkspace()
  const canEditDecision = canReviewPermission(workspace.membershipRole) && !isReadOnly
  const [open, setOpen] = useState(false)
  const [selectedDecision, setSelectedDecision] = useState<DecisionValue | null>(currentDecision?.decision || null)
  const [note, setNote] = useState(currentDecision?.note || "")

  const updateMutation = useUpdateTraceabilityReviewDecision(analysisId, linkId)
  const deleteMutation = useDeleteTraceabilityReviewDecision(analysisId, linkId)

  const handleSave = async () => {
    if (!selectedDecision) return
    try {
      await updateMutation.mutateAsync({ decision: selectedDecision, note })
      setOpen(false)
    } catch (error) {
      toast.error(t("reviewDecisionSaveFailed"), {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  const handleClear = async () => {
    try {
      await deleteMutation.mutateAsync()
      setSelectedDecision(null)
      setNote("")
      setOpen(false)
    } catch (error) {
      toast.error(t("reviewDecisionSaveFailed"), {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  const getDecisionBadgeProps = (decision: DecisionValue | null) => {
    switch (decision) {
      case "ACCEPTED":
        return { variant: "default" as const, className: "bg-success/15 text-success hover:bg-success/25 border-success/30" }
      case "REJECTED":
        return { variant: "destructive" as const, className: "" }
      case "NEEDS_REVIEW":
        return { variant: "outline" as const, className: "border-primary/40 text-primary hover:bg-primary/10" }
      case "NEEDS_MORE_EVIDENCE":
        return { variant: "outline" as const, className: "border-warning/50 text-warning hover:bg-warning/10" }
      default:
        return { variant: "outline" as const, className: "border-dashed text-muted-foreground" }
    }
  }

  const formatDecisionLabel = (decision: DecisionValue | null) => {
    if (!decision) return t("noDecision")
    switch (decision) {
      case "ACCEPTED":
        return t("acceptedDecision")
      case "REJECTED":
        return t("rejectedDecision")
      case "NEEDS_REVIEW":
        return t("needsReviewDecision")
      case "NEEDS_MORE_EVIDENCE":
        return t("needsMoreEvidenceDecision")
    }
  }

  const isLoading = updateMutation.isPending || deleteMutation.isPending

  if (!canEditDecision) {
    return (
      <Badge {...getDecisionBadgeProps(currentDecision?.decision || null)} className={`rounded-sm px-2 py-0.5 text-[11px] font-mono tracking-wide ${getDecisionBadgeProps(currentDecision?.decision || null).className}`}>
        {formatDecisionLabel(currentDecision?.decision || null)}
      </Badge>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (val) {
        setSelectedDecision(currentDecision?.decision || null)
        setNote(currentDecision?.note || "")
      }
      setOpen(val)
    }}>
      <DialogTrigger
        render={
          <button className="focus:outline-none transition-opacity hover:opacity-80 disabled:opacity-50" disabled={isLoading}>
            <Badge {...getDecisionBadgeProps(currentDecision?.decision || null)} className={`rounded-sm px-2 py-0.5 text-[11px] font-mono tracking-wide cursor-pointer ${getDecisionBadgeProps(currentDecision?.decision || null).className}`}>
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1 inline" /> : null}
              {formatDecisionLabel(currentDecision?.decision || null)}
            </Badge>
          </button>
        }
      />
      
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("reviewTraceabilityLink")}</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("decision")}</span>
            <div className="grid grid-cols-2 gap-2">
              {(["ACCEPTED", "REJECTED", "NEEDS_REVIEW", "NEEDS_MORE_EVIDENCE"] as DecisionValue[]).map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant={selectedDecision === d ? "default" : "outline"}
                  className={`justify-start text-[12px] h-8 ${
                    selectedDecision === d && d === 'ACCEPTED' ? 'bg-success hover:bg-success/90 text-white border-success' : ''
                  } ${
                    selectedDecision === d && d === 'REJECTED' ? 'bg-destructive hover:bg-destructive/90 text-white' : ''
                  } ${
                    selectedDecision === d && d === 'NEEDS_REVIEW' ? 'bg-primary hover:bg-primary/90 text-white border-primary' : ''
                  } ${
                    selectedDecision === d && d === 'NEEDS_MORE_EVIDENCE' ? 'bg-warning hover:bg-warning/90 text-white border-warning' : ''
                  }`}
                  onClick={() => setSelectedDecision(d)}
                >
                  {formatDecisionLabel(d)}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("noteOptional")}</span>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("decisionRationalePlaceholder")}
              className="resize-none h-20 text-[13px]"
            />
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClear}
            disabled={!currentDecision || isLoading}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive text-[13px] h-8"
          >
            {t("clearDecision")}
          </Button>
          <div className="flex gap-2">
            <DialogClose
              render={
                <Button type="button" variant="outline" className="text-[13px] h-8">
                  {t("cancel")}
                </Button>
              }
            />
            <Button
              type="button"
              onClick={handleSave}
              disabled={!selectedDecision || isLoading || (selectedDecision === currentDecision?.decision && note === (currentDecision?.note || ""))}
              className="text-[13px] h-8"
            >
              {isLoading && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
              {t("saveDecision")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
