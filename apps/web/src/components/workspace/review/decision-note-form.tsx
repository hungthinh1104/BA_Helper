"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useReviewNotes, useSaveReviewNote } from "@/hooks/api/use-review-notes"
import { Button } from "@/components/ui/button"
import { useCurrentWorkspace } from "@/lib/project-context"
import { canReview } from "@/lib/permissions"

interface DecisionNoteFormProps {
  analysisId: string
  insightId?: string
  traceabilityLinkId?: string
}

export function DecisionNoteForm({ analysisId, insightId, traceabilityLinkId }: DecisionNoteFormProps) {
  const t = useTranslations("workspace")
  const { data: notesData, isLoading } = useReviewNotes(analysisId)
  const saveNoteMutation = useSaveReviewNote(analysisId)
  const workspace = useCurrentWorkspace()

  const existingNote = notesData?.items.find(
    (n) => (insightId && n.insightId === insightId) || (traceabilityLinkId && n.traceabilityLinkId === traceabilityLinkId)
  )

  const [body, setBody] = useState("")
  const [syncedId, setSyncedId] = useState<string | null>(null)

  const currentKey = existingNote ? existingNote.id : (insightId || traceabilityLinkId || "new")
  if (currentKey !== syncedId) {
    setBody(existingNote?.body || "")
    setSyncedId(currentKey)
  }

  const isChanged = body !== (existingNote?.body || "")
  const canRev = workspace ? canReview(workspace.membershipRole) : false

  const handleSave = () => {
    if (!body.trim() || !canRev) return
    saveNoteMutation.mutate({
      insightId: insightId || undefined,
      traceabilityLinkId: traceabilityLinkId || undefined,
      body,
    })
  }

  if (isLoading) {
    return <div className="text-[12px] text-muted-foreground mt-4 animate-pulse">{t("loadingNotes")}</div>
  }

  return (
    <div className="mt-6 pt-4 border-t border-border">
      <h4 className="text-[12px] font-semibold text-foreground mb-3">{t("analystContextNotes")}</h4>
      <div className="flex items-center justify-between mb-2">
        <label htmlFor="decision-note" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("decisionNote")}
        </label>
        <span className={`text-[10px] ${body.length > 2000 ? "text-danger" : "text-muted-foreground"}`}>
          {body.length} / 2000
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
        {t("decisionNoteHelp")} <br />
        <span className="italic opacity-80">{t("decisionNoteExample")}</span>
      </p>
      
      <textarea
        id="decision-note"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        disabled={!canRev}
        placeholder={!canRev ? t("decisionNoteRoleRequired") : t("decisionNotePlaceholder")}
        className={`w-full min-h-[100px] p-3 rounded-md bg-surface-muted border border-border/60 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary resize-y ${!canRev ? "opacity-50 cursor-not-allowed" : ""}`}
        title={!canRev ? t("reviewerOwnerRequired") : undefined}
      />

      <div className="flex items-center justify-between mt-3">
        <span className="text-[11px] font-medium">
          {isChanged ? (
            <span className="text-warning">{t("unsavedChanges")}</span>
          ) : existingNote ? (
            <span className="text-success">{t("saved")}</span>
          ) : null}
        </span>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!isChanged || body.trim().length === 0 || saveNoteMutation.isPending || !canRev}
          className="h-7 text-[11px] bg-primary-action text-primary-action-text"
          title={!canRev ? t("reviewerOwnerRequired") : undefined}
        >
          {saveNoteMutation.isPending ? t("saving") : t("saveNote")}
        </Button>
      </div>
    </div>
  )
}
