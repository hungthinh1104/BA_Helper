import React from "react"
import { useTranslations } from "next-intl"
import { Info, Settings2, ChevronDown, ChevronRight, Calculator } from "lucide-react"
import { RetrievalMetadata } from "@ba-helper/contracts"

export function RetrievalSignalBadge({ retrieval }: { retrieval?: RetrievalMetadata }) {
  if (!retrieval) return null;

  const methodText = retrieval.method;
  const signalsText = retrieval.signals && retrieval.signals.length > 0 
    ? retrieval.signals.join(" + ")
    : null;

  const label = signalsText ? `${methodText} · ${signalsText}` : methodText;

  let variantClass = "badge-neutral";
  if (retrieval.method === "HYBRID") {
    variantClass = "badge-confirmed";
  } else if (retrieval.method === "VECTOR") {
    variantClass = "badge-evidence";
  } else if (retrieval.method === "GRAPH_EXPANSION") {
    variantClass = "badge-inferred";
  }

  return (
    <span className={`badge ${variantClass} text-[9px] uppercase tracking-wider`}>
      {label}
    </span>
  );
}

export function RetrievalReason({ retrieval }: { retrieval?: RetrievalMetadata }) {
  const t = useTranslations("workspace")
  if (!retrieval) return null;

  const reason = retrieval.reason || t("evidenceLinkedToInsight");

  return (
    <div className="flex items-start gap-2 mt-2 px-3 py-2 bg-surface border-l-2 border-primary text-[12px] text-foreground/90 leading-snug">
      <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5 opacity-80" />
      <div>
        <span className="font-medium mr-1">{t("whySelected")}:</span>
        <span className="text-muted-foreground">{reason}</span>
      </div>
    </div>
  );
}

export function RetrievalDebugPanel({ retrieval }: { retrieval?: RetrievalMetadata }) {
  const t = useTranslations("workspace")
  const [isOpen, setIsOpen] = React.useState(false);

  if (!retrieval || !retrieval.score) return null;
  const score = retrieval.score;

  return (
    <div className="mt-2 border border-border rounded-md overflow-hidden bg-surface-muted">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Settings2 className="w-3 h-3 opacity-70" />
          <span>{t("retrievalDiagnostics")}</span>
          <span className="opacity-50">({retrieval.strategyVersion || 'legacy'})</span>
        </div>
        {isOpen ? <ChevronDown className="w-3 h-3 opacity-50" /> : <ChevronRight className="w-3 h-3 opacity-50" />}
      </button>

      {isOpen && (
        <div className="px-3 py-2 border-t border-border bg-surface text-[11px] font-mono grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
          <div className="flex justify-between items-center py-0.5 border-b border-border/50 col-span-2 mb-1">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Calculator className="w-3 h-3 opacity-70" />
              {t("finalScore")}
            </span>
            <span className="font-semibold text-primary">{score.final.toFixed(3)}</span>
          </div>
          
          <div className="flex justify-between items-center py-0.5">
            <span>{t("lexicalScore")}</span>
            <span className="text-foreground/80">{score.lexical !== undefined ? score.lexical.toFixed(3) : '-'}</span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span>{t("graphScore")}</span>
            <span className="text-foreground/80">{score.graph !== undefined ? score.graph.toFixed(3) : '-'}</span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span>{t("vectorScore")}</span>
            <span className="text-foreground/80">{score.vector !== undefined ? score.vector.toFixed(3) : '-'}</span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span>{t("domainBoost")}</span>
            <span className="text-foreground/80">{score.domain !== undefined ? score.domain.toFixed(3) : '-'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
