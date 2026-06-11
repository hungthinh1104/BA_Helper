"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppShell } from "@/components/layout/app-shell"
import { ImpactAnalysisWorkspace } from "@/components/workspace/impact-analysis-workspace"
import { AnalysisHeader } from "@/components/workspace/analysis-header"
import { InsightList } from "@/components/workspace/insight-list"
import { AffectedArtifactCard } from "@/components/workspace/affected-artifact-card"
import { CodeEvidenceBlock } from "@/components/workspace/code-evidence-block"
import { ReviewActionPanel } from "@/components/workspace/review-action-panel"
import { 
  MOCK_IMPACT_ANALYSIS, 
  MOCK_INSIGHTS, 
  MOCK_TRACEABILITY_LINKS 
} from "@/lib/mock-data/impact-analysis"
import { InsightListResponse, TraceabilityLinkListResponse } from "@ba-helper/contracts"

type Insight = InsightListResponse["items"][number]
type TraceabilityLink = TraceabilityLinkListResponse["items"][number]

export default function ImpactAnalysisDetailPage() {
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null)
  const [selectedLink, setSelectedLink] = useState<TraceabilityLink | null>(null)
  
  // Local state for review simulation
  const [insights, setInsights] = useState<Insight[]>(MOCK_INSIGHTS.items)
  const [links, setLinks] = useState<TraceabilityLink[]>(MOCK_TRACEABILITY_LINKS.items)

  const handleSelectInsight = (insight: Insight) => {
    setSelectedInsight(insight)
    setSelectedLink(null)
  }

  const handleSelectLink = (link: TraceabilityLink) => {
    setSelectedLink(link)
    setSelectedInsight(null)
  }

  const handleInsightReviewChange = (status: Insight["reviewStatus"]) => {
    if (!selectedInsight) return
    const updated = { ...selectedInsight, reviewStatus: status }
    setInsights(prev => prev.map(i => i.id === selectedInsight.id ? updated : i))
    setSelectedInsight(updated)
  }

  const handleLinkReviewChange = (status: TraceabilityLink["reviewStatus"]) => {
    if (!selectedLink) return
    const updated = { ...selectedLink, reviewStatus: status }
    setLinks(prev => prev.map(l => l.id === selectedLink.id ? updated : l))
    setSelectedLink(updated)
  }

  const activeItem = selectedInsight || selectedLink
  const activeEvidence = activeItem?.evidence || []

  // Group insights
  const claims = insights.filter(i => i.category === "CLAIM")
  const unknowns = insights.filter(i => i.category === "UNKNOWN")
  const questions = insights.filter(i => i.category === "QUESTION")
  const qaScenarios = insights.filter(i => i.category === "QA_SCENARIO")
  const ac = insights.filter(i => i.category === "ACCEPTANCE_CRITERIA")

  const inspectorContent = activeItem ? (
    <div className="flex flex-col h-full">
      <div className="flex-1">
        {activeEvidence.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">No code evidence linked.</div>
        ) : (
          activeEvidence.map(ev => <CodeEvidenceBlock key={ev.id} evidence={ev} />)
        )}
      </div>
      
      {selectedInsight && (
        <ReviewActionPanel 
          status={selectedInsight.reviewStatus} 
          onStatusChange={handleInsightReviewChange} 
        />
      )}
      {selectedLink && (
        <ReviewActionPanel 
          status={selectedLink.reviewStatus} 
          onStatusChange={handleLinkReviewChange} 
        />
      )}
    </div>
  ) : null

  return (
    <AppShell>
      <ImpactAnalysisWorkspace
        inspectorTitle={
          selectedInsight ? "Insight Evidence" : 
          selectedLink ? "Artifact Link Evidence" : 
          "Select an item to view evidence"
        }
        inspectorSubtitle={
          selectedInsight ? selectedInsight.statement : 
          selectedLink ? selectedLink.evidence[0]?.filePath ?? "Artifact" : 
          undefined
        }
        inspectorContent={inspectorContent}
      >
        <AnalysisHeader analysis={MOCK_IMPACT_ANALYSIS} />
        
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="summary">Impact Summary</TabsTrigger>
            <TabsTrigger value="artifacts">Affected Artifacts</TabsTrigger>
            <TabsTrigger value="questions">Questions & Unknowns</TabsTrigger>
            <TabsTrigger value="qa">QA Scenarios</TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary" className="mt-0 outline-none">
            <div className="grid-2">
              <div>
                <InsightList 
                  title="Impact Claims" 
                  insights={claims} 
                  selectedInsightId={selectedInsight?.id}
                  onSelect={handleSelectInsight}
                />
              </div>
              <div>
                <InsightList 
                  title="Acceptance Criteria" 
                  insights={ac} 
                  selectedInsightId={selectedInsight?.id}
                  onSelect={handleSelectInsight}
                  emptyMessage="No acceptance criteria generated."
                />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="artifacts" className="mt-0 outline-none">
            <div className="flex flex-col gap-3">
              {links.map(link => (
                <AffectedArtifactCard 
                  key={link.id} 
                  link={link} 
                  isSelected={selectedLink?.id === link.id}
                  onClick={handleSelectLink}
                />
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="questions" className="mt-0 outline-none">
            <div className="grid-2">
              <div>
                <InsightList 
                  title="Unknowns" 
                  insights={unknowns} 
                  selectedInsightId={selectedInsight?.id}
                  onSelect={handleSelectInsight}
                  emptyMessage="No unknowns detected."
                />
              </div>
              <div>
                <InsightList 
                  title="BA Questions" 
                  insights={questions} 
                  selectedInsightId={selectedInsight?.id}
                  onSelect={handleSelectInsight}
                  emptyMessage="No questions generated."
                />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="qa" className="mt-0 outline-none">
            <InsightList 
              title="QA Scenarios" 
              insights={qaScenarios} 
              selectedInsightId={selectedInsight?.id}
              onSelect={handleSelectInsight}
              emptyMessage="No QA scenarios generated."
            />
          </TabsContent>
        </Tabs>
      </ImpactAnalysisWorkspace>
    </AppShell>
  )
}
