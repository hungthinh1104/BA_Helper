import { ApprovedImpactReportResponse } from "@ba-helper/contracts";

interface EvidenceQualitySummaryProps {
  summary: ApprovedImpactReportResponse["evidenceQualitySummary"];
}

export function EvidenceQualitySummary({ summary }: EvidenceQualitySummaryProps) {
  if (!summary) return null;

  const strong = summary.strongSourceEvidence ?? summary.evidenced;
  const inferred = summary.inferredFromStructure ?? summary.inferred;
  const weak = summary.weakSourceEvidence ?? summary.weakEvidence;
  const domainHintOnly = summary.domainHintOnly ?? 0;
  const conflicting = summary.conflictingEvidence ?? 0;

  return (
    <div className="mt-8 space-y-4">
      <h3 className="text-base font-semibold text-foreground tracking-tight">Evidence Quality Summary</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex flex-col rounded-lg border border-border/50 bg-surface px-4 py-3">
          <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Strong Source</span>
          <span className="text-xl font-semibold text-foreground">{strong}</span>
        </div>
        <div className="flex flex-col rounded-lg border border-border/50 bg-surface px-4 py-3">
          <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Inferred</span>
          <span className="text-xl font-semibold text-foreground">{inferred}</span>
        </div>
        <div className="flex flex-col rounded-lg border border-border/50 bg-surface px-4 py-3">
          <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Weak Evidence</span>
          <span className="text-xl font-semibold text-foreground">{weak}</span>
        </div>
        <div className="flex flex-col rounded-lg border border-border/50 bg-surface px-4 py-3">
          <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Missing Evidence</span>
          <span className="text-xl font-semibold text-foreground">{summary.missingEvidence}</span>
        </div>
        <div className="flex flex-col rounded-lg border border-border/50 bg-surface px-4 py-3">
          <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Review Required</span>
          <span className="text-xl font-semibold text-foreground">{summary.reviewRequired}</span>
        </div>
        <div className="flex flex-col rounded-lg border border-border/50 bg-surface px-4 py-3">
          <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Domain Hint Only</span>
          <span className="text-xl font-semibold text-foreground">{domainHintOnly}</span>
        </div>
        <div className="flex flex-col rounded-lg border border-border/50 bg-surface px-4 py-3">
          <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Conflicting</span>
          <span className="text-xl font-semibold text-foreground">{conflicting}</span>
        </div>
      </div>
    </div>
  );
}
