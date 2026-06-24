import { TraceabilityLinkListResponse } from "@ba-helper/contracts"
import { RetrievalSignalBadge } from "@/components/workspace/analysis/retrieval/retrieval-signals"

type TraceabilityLink = TraceabilityLinkListResponse["items"][number]

interface AffectedArtifactCardProps {
  link: TraceabilityLink
  isSelected?: boolean
  onClick?: (link: TraceabilityLink) => void
}

function getReviewIcon(status: TraceabilityLink["reviewStatus"]) {
  if (status === "CONFIRMED") return <div className="w-3.5 h-3.5 rounded-full border-2 border-success flex items-center justify-center bg-success/10"><span className="w-1.5 h-1.5 bg-success rounded-full"></span></div>
  if (status === "REJECTED") return <div className="w-3.5 h-3.5 rounded-full border-2 border-danger flex items-center justify-center bg-danger/10"><span className="w-1.5 h-1.5 bg-danger rounded-full"></span></div>
  return <div className="w-3.5 h-3.5 rounded-full border-2 border-warning border-dashed"></div>
}

import { CertaintyBadge, ArtifactKindBadge } from "@/components/workspace/shared/status-badges"

export function AffectedArtifactCard({ link, isSelected, onClick }: AffectedArtifactCardProps) {
  const filePath = link.evidence[0]?.filePath ?? "Unknown File"
  const fileName = filePath.split("/").pop() ?? filePath
  const fileDir = filePath.split("/").slice(-2, -1)[0]

  return (
    <div
      className={`relative group flex items-start gap-3 py-2.5 px-3 cursor-pointer transition-colors border-b border-border/50 last:border-0 ${
        isSelected ? "bg-surface-soft" : "hover:bg-surface-muted/50"
      }`}
      onClick={() => onClick && onClick(link)}
    >
      {/* Accent line for selected */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary rounded-r-full"></div>
      )}

      {/* Review Status Icon */}
      <div className="mt-1 shrink-0">
        {getReviewIcon(link.reviewStatus)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-4">
          <p className={`text-[13px] font-mono leading-snug m-0 pr-2 ${isSelected ? "text-foreground font-medium" : "text-foreground/90"}`}>
            <span className="text-muted-foreground/60">{fileDir}/</span>{fileName}
          </p>
          <div className="shrink-0 flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
            {link.retrieval && <RetrievalSignalBadge retrieval={link.retrieval} />}
            <CertaintyBadge certainty={link.linkBasis} />
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <ArtifactKindBadge kind={link.linkType} />
          <span className="text-[11px] font-mono text-muted-foreground/50 truncate">{filePath}</span>
        </div>
      </div>
    </div>
  )
}
