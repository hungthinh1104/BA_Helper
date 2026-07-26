import { memo, useCallback } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { NewRequirementDialog } from "@/components/workspace/requirement/new-requirement-dialog"
import { RequirementSelectionStepProps } from "./new-analysis-types"
import type { RequirementListItemResponse } from "@ba-helper/contracts"

const RequirementOption = memo(function RequirementOption({
  requirement,
  selected,
  onSelect,
}: {
  requirement: RequirementListItemResponse
  selected: boolean
  onSelect: (requirement: RequirementListItemResponse) => void
}) {
  const handleSelect = useCallback(() => onSelect(requirement), [onSelect, requirement])

  return (
    <button
      onClick={handleSelect}
      className={`text-left p-3.5 rounded-lg border transition-all ${
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-border/60 bg-surface hover:bg-surface-soft hover:border-border"
      }`}
    >
      <p className="text-[13px] font-medium text-foreground">{requirement.latestRevision.title}</p>
      <p className="text-[11px] text-muted-foreground font-mono mt-1">{requirement.latestRevision.id}</p>
      <p className="text-[12px] text-muted-foreground/70 mt-1 line-clamp-2 leading-relaxed">
        {requirement.latestRevision.rawText}
      </p>
    </button>
  )
})

export function RequirementSelectionStep({
  reqsLoading,
  reqsError,
  readyReqs,
  selectedReq,
  setSelectedReq,
  handleNext,
}: RequirementSelectionStepProps) {
  const t = useTranslations("newAnalysis")

  return (
    <div className="flex flex-col">
      <div className="px-6 py-4 flex flex-col gap-2 max-h-72 overflow-y-auto">
        {reqsLoading ? (
          <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-[13px]">{t("loadingRequirements")}</span>
          </div>
        ) : reqsError ? (
          <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
            <AlertCircle className="w-5 h-5 text-danger" />
            <span className="text-[13px]">{t("failedRequirements")}</span>
          </div>
        ) : readyReqs.length === 0 ? (
          <div className="py-8 flex flex-col items-center gap-3 text-center text-[13px] text-muted-foreground">
            <p>{t("noReadyRequirements")}</p>
            <NewRequirementDialog>
              <Button size="sm" variant="outline" className="shadow-none">{t("createRequirement")}</Button>
            </NewRequirementDialog>
          </div>
        ) : (
          readyReqs.map((req) => (
            <RequirementOption
              key={req.id}
              requirement={req}
              selected={selectedReq?.id === req.id}
              onSelect={setSelectedReq}
            />
          ))
        )}
      </div>
      <div className="px-6 py-4 border-t border-border/60 bg-surface-muted/30 flex justify-end">
        <Button size="sm" className="h-8 shadow-none" disabled={!selectedReq} onClick={handleNext}>
          {t("next")}
        </Button>
      </div>
    </div>
  )
}
