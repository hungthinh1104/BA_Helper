import { ApprovedImpactReportResponse } from "@ba-helper/contracts";
import { Badge } from "@/components/ui/badge";

interface EvidenceQualityTableProps {
  items: ApprovedImpactReportResponse["evidenceQualityItems"];
}

export function EvidenceQualityTable({ items }: EvidenceQualityTableProps) {
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
                <th className="px-4 py-3 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 bg-surface">
              {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-foreground/90 whitespace-nowrap break-all">
                    {item.artifact}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <EvidenceQualityBadge quality={item.quality} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
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

function EvidenceQualityBadge({ quality }: { quality: string }) {
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
