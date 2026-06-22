import { type ReactNode } from "react"
import { ImpactAnalysisWorkspace } from "@/components/workspace/analysis/impact-analysis-workspace"
import { ReviewActionPanel } from "@/components/workspace/review/review-action-panel"
import { AnalysisEvidenceInspector } from "./analysis-evidence-inspector"
import { CertaintyBadge } from "@/components/workspace/shared/status-badges"
import type {
  InsightListResponse,
  TraceabilityLinkListResponse,
  ImpactGraphNode,
  QaCoverageResponse,
} from "@ba-helper/contracts"

type Insight = InsightListResponse["items"][number]
type TraceabilityLink = TraceabilityLinkListResponse["items"][number]
type EvidenceItem = Insight["evidence"][number]
type QaCoverageItem = QaCoverageResponse["items"][number]

interface AnalysisInspectorMapperProps {
  analysisId: string
  currentTab: string
  selectedInsight: Insight | null
  selectedLink: TraceabilityLink | null
  selectedGraphNode: ImpactGraphNode | null
  linkedInsights: Insight[]
  activeEvidence: EvidenceItem[]
  qaCoverageData: QaCoverageItem[]
  canReview: boolean
  isFullHeightTab: boolean
  children: ReactNode
  
  onSelectInsight: (insight: Insight) => void
  onCloseInspector: () => void
  onInsightReviewChange: (status: Insight["reviewStatus"]) => Promise<void>
  onLinkReviewChange: (status: TraceabilityLink["reviewStatus"]) => Promise<void>
}

export function AnalysisInspectorMapper({
  analysisId,
  currentTab,
  selectedInsight,
  selectedLink,
  selectedGraphNode,
  linkedInsights,
  activeEvidence,
  qaCoverageData,
  canReview,
  isFullHeightTab,
  children,
  onSelectInsight,
  onCloseInspector,
  onInsightReviewChange,
  onLinkReviewChange,
}: AnalysisInspectorMapperProps) {
  // ── Evidence inspector ──
  const inspectorContent = (
    <AnalysisEvidenceInspector
      analysisId={analysisId}
      selectedInsight={selectedInsight}
      activeEvidence={activeEvidence}
      selectedLink={selectedLink}
      linkedInsights={linkedInsights}
      selectedGraphNode={selectedGraphNode}
      qaCoverageData={qaCoverageData}
      onSelectInsight={onSelectInsight}
      onCloseGraphNode={onCloseInspector}
    />
  )

  const inspectorFooter = !canReview ? undefined : selectedInsight ? (
    <ReviewActionPanel
      status={selectedInsight.reviewStatus}
      canReview={canReview}
      onStatusChange={onInsightReviewChange}
    />
  ) : selectedLink ? (
    <ReviewActionPanel
      status={selectedLink.reviewStatus}
      canReview={canReview}
      onStatusChange={onLinkReviewChange}
    />
  ) : undefined

  return (
    <ImpactAnalysisWorkspace
      inspectorTitle={
        isFullHeightTab ? undefined :
        selectedInsight ? selectedInsight.statement :
        selectedLink ? (selectedLink.evidence[0]?.filePath ?? "Artifact") :
        "Evidence Inspector"
      }
      inspectorSubtitle={
        isFullHeightTab ? undefined :
        selectedInsight ? selectedInsight.statement :
        selectedLink ? (selectedLink.evidence[0]?.filePath ?? "Artifact") :
        undefined
      }
      inspectorCategory={isFullHeightTab ? undefined : selectedInsight?.category}
      inspectorCertaintyBadge={
        isFullHeightTab || !selectedInsight ? undefined : (
          <CertaintyBadge certainty={selectedInsight.certainty} />
        )
      }
      inspectorContent={inspectorContent}
      inspectorFooter={currentTab === "review-queue" ? undefined : inspectorFooter}
      onCloseInspector={onCloseInspector}
    >
      {children}
    </ImpactAnalysisWorkspace>
  )
}
