import { ApprovedImpactReportResponse } from "@ba-helper/contracts";
import { useTranslations } from "next-intl";
import { DenseCard } from "@/components/workspace/shared/dense-card";

interface EvidenceQualitySummaryProps {
  summary: ApprovedImpactReportResponse["evidenceQualitySummary"];
}

export function EvidenceQualitySummary({ summary }: EvidenceQualitySummaryProps) {
  const t = useTranslations("reports");

  if (!summary) return null;

  const strong = summary.strongSourceEvidence ?? summary.evidenced;
  const inferred = summary.inferredFromStructure ?? summary.inferred;
  const weak = summary.weakSourceEvidence ?? summary.weakEvidence;
  const domainHintOnly = summary.domainHintOnly ?? 0;
  const conflicting = summary.conflictingEvidence ?? 0;

  return (
    <div className="mt-8 space-y-4">
      <h3 className="text-base font-semibold text-foreground tracking-tight">{t("evidenceQualitySummary")}</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DenseCard className="px-4 py-3">
          <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{t("strongSource")}</span>
          <span className="text-xl font-semibold text-foreground">{strong}</span>
        </DenseCard>
        <DenseCard className="px-4 py-3">
          <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{t("inferred")}</span>
          <span className="text-xl font-semibold text-foreground">{inferred}</span>
        </DenseCard>
        <DenseCard className="px-4 py-3">
          <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{t("weakEvidence")}</span>
          <span className="text-xl font-semibold text-foreground">{weak}</span>
        </DenseCard>
        <DenseCard className="px-4 py-3">
          <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{t("missingEvidence")}</span>
          <span className="text-xl font-semibold text-foreground">{summary.missingEvidence}</span>
        </DenseCard>
        <DenseCard className="px-4 py-3">
          <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{t("reviewRequired")}</span>
          <span className="text-xl font-semibold text-foreground">{summary.reviewRequired}</span>
        </DenseCard>
        <DenseCard className="px-4 py-3">
          <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{t("domainHintOnly")}</span>
          <span className="text-xl font-semibold text-foreground">{domainHintOnly}</span>
        </DenseCard>
        <DenseCard className="px-4 py-3">
          <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{t("conflicting")}</span>
          <span className="text-xl font-semibold text-foreground">{conflicting}</span>
        </DenseCard>
      </div>
    </div>
  );
}
