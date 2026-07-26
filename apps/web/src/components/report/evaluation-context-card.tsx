import { ApprovedImpactReportResponse } from "@ba-helper/contracts";
import { AlertCircle, Info } from "lucide-react";
import { useTranslations } from "next-intl";

interface EvaluationContextCardProps {
  context: ApprovedImpactReportResponse["evaluationContext"];
}

export function EvaluationContextCard({ context }: EvaluationContextCardProps) {
  const t = useTranslations("reports");
  if (!context) return null;

  return (
    <div className="mt-8 rounded-xl border border-border/60 bg-surface px-6 py-6 space-y-5">
      <div className="flex items-center gap-2 border-b border-border/50 pb-4">
        <Info className="w-5 h-5 text-muted-foreground" />
        <h3 className="text-base font-semibold text-foreground tracking-tight">{t("evaluationContext")}</h3>
      </div>

      {context.interpretation === "ILLUSTRATIVE_ONLY" && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/25 bg-warning/10 p-4 text-warning">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-[13px] tracking-wide">{t("illustrativeOnly")}</span>
            <span className="text-[13px] text-warning/80">
              {t("illustrativeOnlyDescription", { subsetSize: context.subsetSize })}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px] text-muted-foreground">
        <div>
          <strong className="text-foreground/80 font-medium">{t("datasetVersion")}</strong>{" "}
          <span className="font-mono ml-2">{context.datasetVersion}</span>
        </div>
        <div>
          <strong className="text-foreground/80 font-medium">{t("subsetId")}</strong>{" "}
          <span className="font-mono ml-2">{context.subsetId}</span>
        </div>
      </div>

      {context.knownLimits && context.knownLimits.length > 0 && (
        <div className="space-y-2">
          <strong className="text-[13px] text-foreground/80 font-medium">{t("knownLimits")}</strong>
          <ul className="list-disc list-outside ml-4 space-y-1 text-[13px] text-muted-foreground">
            {context.knownLimits.map((limit, i) => (
              <li key={i}>{limit}</li>
            ))}
          </ul>
        </div>
      )}

      {context.datasetExpansionRecommendations && context.datasetExpansionRecommendations.length > 0 && (
        <div className="space-y-2">
          <strong className="text-[13px] text-foreground/80 font-medium">{t("datasetExpansionRecommendations")}</strong>
          <ul className="list-disc list-outside ml-4 space-y-1 text-[13px] text-muted-foreground">
            {context.datasetExpansionRecommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {context.evidenceQualityNotes && context.evidenceQualityNotes.length > 0 && (
        <div className="space-y-2">
          <strong className="text-[13px] text-foreground/80 font-medium">{t("evidenceQualityNotes")}</strong>
          <ul className="list-disc list-outside ml-4 space-y-1 text-[13px] text-muted-foreground">
            {context.evidenceQualityNotes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
