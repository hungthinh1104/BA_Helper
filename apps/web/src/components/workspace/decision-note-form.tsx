"use client"

import { useState } from "react"
import { useReviewNotes, useSaveReviewNote } from "@/hooks/api/use-review-notes"
import { Button } from "@/components/ui/button"

interface DecisionNoteFormProps {
  analysisId: string
  insightId?: string
  traceabilityLinkId?: string
}

export function DecisionNoteForm({ analysisId, insightId, traceabilityLinkId }: DecisionNoteFormProps) {
  const { data: notesData, isLoading } = useReviewNotes(analysisId)
  const saveNoteMutation = useSaveReviewNote(analysisId)

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

  const handleSave = () => {
    if (!body.trim()) return
    saveNoteMutation.mutate({
      insightId: insightId || undefined,
      traceabilityLinkId: traceabilityLinkId || undefined,
      body,
    })
  }

  if (isLoading) {
    return <div className="text-[12px] text-muted-foreground mt-4 animate-pulse">Loading notes...</div>
  }

  return (
    <div className="mt-6 pt-4 border-t border-border">
      <div className="flex items-center justify-between mb-2">
        <label htmlFor="decision-note" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
          Decision Note
        </label>
        <span className={`text-[10px] ${body.length > 2000 ? "text-danger" : "text-muted-foreground"}`}>
          {body.length} / 2000
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
        Add context for why this item was confirmed or rejected. <br />
        <span className="italic opacity-80">Example: Confirmed with backend team; refund trigger is in scope for this requirement.</span>
      </p>
      
      <textarea
        id="decision-note"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        placeholder="Type your decision note here..."
        className="w-full min-h-[100px] p-3 rounded-md bg-surface-muted border border-border/60 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary resize-y"
      />

      <div className="flex items-center justify-between mt-3">
        <span className="text-[11px] font-medium">
          {isChanged ? (
            <span className="text-warning">Unsaved changes</span>
          ) : existingNote ? (
            <span className="text-success">Saved</span>
          ) : null}
        </span>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!isChanged || body.trim().length === 0 || saveNoteMutation.isPending}
          className="h-7 text-[11px] bg-primary-action text-primary-action-text"
        >
          {saveNoteMutation.isPending ? "Saving..." : "Save Note"}
        </Button>
      </div>
    </div>
  )
}
