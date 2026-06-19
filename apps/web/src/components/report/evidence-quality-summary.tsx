import { ApprovedImpactReportResponse } from "@ba-helper/contracts";

interface EvidenceQualitySummaryProps {
  summary: ApprovedImpactReportResponse["evidenceQualitySummary"];
}

export function EvidenceQualitySummary({ summary }: EvidenceQualitySummaryProps) {
  if (!summary) return null;

  return (
    <div className="mt-8 space-y-4">
      <h3 className="text-base font-semibold text-foreground tracking-tight">Evidence Quality Summary</h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="flex flex-col rounded-lg border border-border/50 bg-surface px-4 py-3">
          <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Evidenced</span>
          <span className="text-xl font-semibold text-foreground">{summary.evidenced}</span>
        </div>
        <div className="flex flex-col rounded-lg border border-border/50 bg-surface px-4 py-3">
          <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Inferred</span>
          <span className="text-xl font-semibold text-foreground">{summary.inferred}</span>
        </div>
        <div className="flex flex-col rounded-lg border border-border/50 bg-surface px-4 py-3">
          <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Weak Evidence</span>
          <span className="text-xl font-semibold text-foreground">{summary.weakEvidence}</span>
        </div>
        <div className="flex flex-col rounded-lg border border-border/50 bg-surface px-4 py-3">
          <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Missing Evidence</span>
          <span className="text-xl font-semibold text-foreground">{summary.missingEvidence}</span>
        </div>
        <div className="flex flex-col rounded-lg border border-border/50 bg-surface px-4 py-3">
          <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Review Required</span>
          <span className="text-xl font-semibold text-foreground">{summary.reviewRequired}</span>
        </div>
      </div>
    </div>
  );
}
