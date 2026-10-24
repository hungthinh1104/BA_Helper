"use client"

import { useMemo, useState } from "react"
import { Background, BackgroundVariant, Handle, MarkerType, Position, ReactFlow } from "@xyflow/react"
import type { Edge, Node, NodeProps } from "@xyflow/react"
import type { ComprehensionScenario } from "@ba-helper/contracts"

type TraceNodeData = { label: string; filePath: string; startLine: number | null; kind: "test" | "code" }
type TraceNode = Node<TraceNodeData, "comprehensionTraceNode">
type TraceSnapshotContext = { snapshotId: string; commitSha: string }

export function CodeComprehensionTraceFlow({ scenario, snapshotContext }: { scenario: ComprehensionScenario; snapshotContext?: TraceSnapshotContext }) {
  const [selected, setSelected] = useState<{ kind: "node" | "edge"; id: string } | null>(null)
  const trace = scenario.trace
  const nodes = useMemo<TraceNode[]>(() => (trace?.artifacts ?? []).map((artifact, index) => ({
    id: artifact.id,
    type: "comprehensionTraceNode",
    position: { x: index * 245, y: 80 },
    data: { label: artifact.name, filePath: artifact.filePath, startLine: artifact.startLine, kind: index === 0 ? "test" : "code" },
  })), [trace?.artifacts])
  const edges = useMemo<Edge[]>(() => (trace?.relationships ?? []).map((relationship) => ({
    id: relationship.edgeId,
    source: relationship.sourceArtifactId,
    target: relationship.targetArtifactId,
    type: "smoothstep",
    label: relationship.type,
    labelStyle: { fill: "var(--text-secondary)", fontSize: 10 },
    labelBgStyle: { fill: "var(--background)" },
    style: { stroke: "var(--text-tertiary)", strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "var(--text-tertiary)" },
  })), [trace?.relationships])
  if (!trace) return <p className="text-[11px] text-warning">No connected static path is available for this scenario.</p>

  const selectedNode = selected?.kind === "node" ? trace.artifacts.find((artifact) => artifact.id === selected.id) : undefined
  const selectedEdge = selected?.kind === "edge" ? trace.relationships.find((relationship) => relationship.edgeId === selected.id) : undefined
  return (
    <div className="grid gap-2 rounded-lg border border-border/40 bg-background/50 p-2" role="region" aria-label="Interactive static test trace">
      <div className="h-[250px] overflow-x-auto rounded border border-border/40 bg-background">
        <div style={{ width: Math.max(500, nodes.length * 245), height: 240 }}>
          <ReactFlow<TraceNode>
            nodes={nodes}
            edges={edges}
            nodeTypes={{ comprehensionTraceNode: ComprehensionTraceNode }}
            fitView
            fitViewOptions={{ padding: 0.14, minZoom: 0.55, maxZoom: 1 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            onNodeClick={(_, node) => setSelected({ kind: "node", id: node.id })}
            onEdgeClick={(_, edge) => setSelected({ kind: "edge", id: edge.id })}
            panOnDrag
            zoomOnScroll={false}
            zoomOnDoubleClick={false}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--border)" />
          </ReactFlow>
        </div>
      </div>
      {selectedNode && <div className="rounded border border-border/40 px-3 py-2 text-[11px]" role="status"><span className="font-semibold">Selected artifact:</span> {selectedNode.name} · <span className="font-mono">{selectedNode.filePath}:{selectedNode.startLine ?? "?"}</span>{snapshotContext && <p className="mt-1 text-muted-foreground">Snapshot {snapshotContext.snapshotId} · commit {snapshotContext.commitSha}</p>}</div>}
      {selectedEdge && <div className="rounded border border-border/40 px-3 py-2 text-[11px]" role="status"><span className="font-semibold">Selected {selectedEdge.type} relationship.</span>{selectedEdge.evidence ? <><span className="ml-1 font-mono">{selectedEdge.evidence.filePath}:{selectedEdge.evidence.startLine ?? "?"}</span><p className="mt-1 text-muted-foreground">{selectedEdge.evidence.evidenceKind} · {selectedEdge.evidence.sourceType} · commit {selectedEdge.evidence.commitSha}</p><p className="mt-1 text-muted-foreground">{selectedEdge.evidence.excerpt}</p>{snapshotContext && <p className="mt-1 text-muted-foreground">Snapshot {snapshotContext.snapshotId}</p>}</> : <p className="mt-1 text-warning">No persisted source evidence is attached to this edge; the relationship remains static and unresolved for inspection.</p>}</div>}
      {!selected && <p className="px-1 text-[11px] text-muted-foreground">Select a node or edge to inspect its static identity and evidence.</p>}
    </div>
  )
}

function ComprehensionTraceNode({ data }: NodeProps<TraceNode>) {
  const tone = data.kind === "test" ? "border-warning/40 bg-warning/5" : "border-border/60 bg-surface"
  return <div className={`relative w-[210px] rounded-lg border px-3 py-2 shadow-sm ${tone}`}><Handle type="target" position={Position.Left} className="!invisible" /><Handle type="source" position={Position.Right} className="!invisible" /><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{data.kind === "test" ? "TEST" : "CODE"}</p><p className="mt-1 line-clamp-2 break-words text-xs font-semibold text-foreground">{data.label}</p><p className="mt-1 line-clamp-1 break-all font-mono text-[10px] text-muted-foreground">{data.filePath}:{data.startLine ?? "?"}</p></div>
}
