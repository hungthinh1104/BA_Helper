import React from "react"
import { useTranslations } from "next-intl"
import { ShieldAlert, Info, Lightbulb, Activity, CheckCircle2 } from "lucide-react"
import { RetrievalMetadata } from "@ba-helper/contracts"
import { DenseCard } from "@/components/workspace/shared/dense-card"

// Frontend now uses the suggestion provided by the backend.

export function RetrievalSuggestion({ retrieval }: { retrieval?: RetrievalMetadata }) {
  const t = useTranslations("workspace")
  if (!retrieval || !retrieval.suggestion) return null;
  const suggestion = retrieval.suggestion;

  let confidenceColor = "text-muted-foreground bg-muted";
  let ConfidenceIcon = Info;
  
  if (suggestion.confidence === "STRONG") {
    confidenceColor = "text-success border-success/30 bg-success/10";
    ConfidenceIcon = CheckCircle2;
  } else if (suggestion.confidence === "MODERATE") {
    confidenceColor = "text-warning border-warning/30 bg-warning/10";
    ConfidenceIcon = Activity;
  } else if (suggestion.confidence === "WEAK") {
    confidenceColor = "text-danger border-danger/30 bg-danger/10";
    ConfidenceIcon = ShieldAlert;
  }

  return (
    <DenseCard className="mt-3 shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-muted">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex-1">
          {t("reviewSuggestion")}
        </span>
        <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${confidenceColor}`}>
          <ConfidenceIcon className="w-3 h-3" />
          {t("confidenceLabel", { confidence: suggestion.confidence })}
        </span>
      </div>
      
      <div className="p-3 flex flex-col gap-3 text-[12px] leading-relaxed">
        <div>
          <span className="font-semibold text-foreground mr-1.5">{t("why")}:</span>
          <span className="text-muted-foreground">{suggestion.why}</span>
        </div>
        
        <div>
          <span className="font-semibold text-foreground mr-1.5 text-primary flex items-center inline-flex gap-1">
            <Lightbulb className="w-3 h-3" />
            {t("suggestedAction")}:
          </span>
          <span className="text-muted-foreground">{suggestion.suggestedAction}</span>
        </div>

        {suggestion.qaFocus && (
          <div>
            <span className="font-semibold text-foreground mr-1.5">{t("qaFocus")}:</span>
            <span className="text-muted-foreground">{suggestion.qaFocus}</span>
          </div>
        )}
        
        {suggestion.baQuestion && (
          <div>
            <span className="font-semibold text-foreground mr-1.5">{t("baQuestion")}:</span>
            <span className="text-muted-foreground">{suggestion.baQuestion}</span>
          </div>
        )}

        {suggestion.risk && (
          <div className="pt-2 mt-1 border-t border-border/50">
            <span className="font-semibold text-danger mr-1.5 flex items-center inline-flex gap-1">
              <ShieldAlert className="w-3 h-3" />
              {t("risk")}:
            </span>
            <span className="text-muted-foreground">{suggestion.risk}</span>
          </div>
        )}
      </div>
    </DenseCard>
  );
}
