import { Badge } from "@/components/ui/badge"
import { TraceabilityLinkListResponse } from "@ba-helper/contracts"

type TraceabilityLink = TraceabilityLinkListResponse["items"][number]

interface AffectedArtifactCardProps {
  link: TraceabilityLink
  isSelected?: boolean
  onClick?: (link: TraceabilityLink) => void
}

function getBasisBadge(basis: TraceabilityLink["linkBasis"]) {
  if (basis === "EVIDENCED") return <Badge className="badge-confirmed">Evidenced</Badge>
  if (basis === "INFERRED") return <Badge className="badge-inferred">Inferred</Badge>
  return <Badge className="badge-neutral">{basis}</Badge>
}

export function AffectedArtifactCard({ link, isSelected, onClick }: AffectedArtifactCardProps) {
  const filePath = link.evidence[0]?.filePath ?? "Unknown File"
  
  return (
    <div 
      className={`artifact-item cursor-pointer transition-colors hover:bg-surface-soft ${isSelected ? "border-primary bg-surface-soft" : ""}`}
      onClick={() => onClick && onClick(link)}
    >
      <div className="flex flex-col items-start gap-1">
        <Badge variant="secondary" className="text-[10px] uppercase">
          {link.linkType}
        </Badge>
        {getBasisBadge(link.linkBasis)}
      </div>
      <div className="min-w-0">
        <div className="artifact-name font-mono text-sm">{filePath.split('/').pop()}</div>
        <div className="artifact-path">{filePath}</div>
      </div>
      <div className="text-right">
        {link.reviewStatus === "CONFIRMED" && <span className="text-success text-xs font-semibold">✓</span>}
        {link.reviewStatus === "REJECTED" && <span className="text-danger text-xs font-semibold">✗</span>}
        {link.reviewStatus === "NEEDS_REVIEW" && <span className="text-warning text-xs font-semibold">●</span>}
      </div>
    </div>
  )
}
