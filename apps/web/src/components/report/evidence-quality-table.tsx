import { ApprovedImpactReportResponse } from "@ba-helper/contracts";
import { Badge } from "@/components/ui/badge";
import { ReviewDecisionControls } from "./review-decision-controls";

interface EvidenceQualityTableProps {
  analysisId: string;
  items: ApprovedImpactReportResponse["evidenceQualityItems"];
}

export function EvidenceQualityTable({ analysisId, items }: EvidenceQualityTableProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className="mt-6 space-y-4">
      <h3 className="text-base font-semibold text-foreground tracking-tight">Evidence Quality Details</h3>
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse">
            <thead className="bg-surface-muted border-b border-border/50 text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Artifact</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Quality</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Review Decision</th>
                <th className="px-4 py-3 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 bg-surface">
              {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-foreground/90 whitespace-nowrap break-all align-top">
                    {item.artifact}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap align-top">
                    <EvidenceQualityBadge quality={item.quality} />
                  </td>
                  <td className="px-4 py-3 align-top min-w-[180px]">
                    <ReviewDecisionControls
                      analysisId={analysisId}
                      linkId={item.linkId}
                      currentDecision={item.reviewDecision}
                    />
                    {item.reviewDecision?.note && (
                      <div className="mt-2 text-[12px] text-muted-foreground leading-relaxed italic border-l-2 border-border pl-2">
                        {item.reviewDecision.note}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground align-top">
                    {item.reasons.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function EvidenceQualityBadge({ quality }: { quality: string }) {
  // Use neutral technical variants to avoid pass/fail coloring
  let variant: "default" | "secondary" | "outline" | "destructive" = "secondary";
  
  if (quality === "EVIDENCED") variant = "default";
  else if (quality === "INFERRED") variant = "secondary";
  else if (quality === "WEAK_EVIDENCE") variant = "outline";
  else if (quality === "MISSING_EVIDENCE") variant = "outline";
  else if (quality === "REVIEW_REQUIRED") variant = "secondary";

  return (
    <Badge variant={variant} className="rounded-md px-2 py-0.5 text-[11px] font-mono tracking-wide">
      {quality}
    </Badge>
  );
}
