"use client"

import { useCallback, useMemo } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  NodeMouseHandler,
  MarkerType,
  BackgroundVariant,
  Node,
  Edge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import dagre from "dagre"
import { ImpactGraphNode, ImpactGraphEdge } from "@ba-helper/contracts"
import { ImpactGraphNodeComponent } from "./impact-graph-node"

const NODE_WIDTH = 220
const NODE_HEIGHT = 90

// dagre hierarchical layout
function getLayoutedElements(
  nodes: ImpactGraphNode[],
  edges: ImpactGraphEdge[],
): { layoutedNodes: Node[]; layoutedEdges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: "TB", nodesep: 50, ranksep: 80 })

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  const layoutedNodes: Node[] = nodes.map((node) => {
    const pos = g.node(node.id)
    return {
      id: node.id,
      type: "impactNode",
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: node,
    }
  })

  const layoutedEdges: Edge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: "smoothstep",
    animated: edge.sourceKind === "TRACEABILITY",
    markerEnd: { type: MarkerType.ArrowClosed, color: "var(--accent)", width: 14, height: 14 },
    style: {
      stroke:
        edge.type === "AFFECTS" ? "var(--accent)" :
        edge.type === "CALLS"   ? "var(--info)" :
        edge.type === "USES"    ? "var(--success)" :
        edge.type === "TESTS"   ? "var(--warning)" :
        "var(--text-tertiary)",
      strokeWidth: edge.sourceKind === "DEPENDENCY" ? 1.5 : 2,
      strokeDasharray: edge.type === "RAISES_UNKNOWN" || edge.type === "SUGGESTS_QA" ? "5,5" : undefined,
    },
    labelStyle: { fontSize: 10, fill: "var(--text-tertiary)" },
    data: edge,
  }))

  return { layoutedNodes, layoutedEdges }
}

const nodeTypes = { impactNode: ImpactGraphNodeComponent }

interface Props {
  nodes: ImpactGraphNode[]
  edges: ImpactGraphEdge[]
  isTruncated?: boolean
  onNodeSelect?: (node: ImpactGraphNode | null) => void
}

export function ImpactGraphView({ nodes: rawNodes, edges: rawEdges, isTruncated, onNodeSelect }: Props) {
  const { layoutedNodes, layoutedEdges } = useMemo(
    () => getLayoutedElements(rawNodes, rawEdges),
    [rawNodes, rawEdges],
  )

  const [nodes, , onNodesChange] = useNodesState(layoutedNodes)
  const [edges, , onEdgesChange] = useEdgesState(layoutedEdges)

  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    onNodeSelect?.(node.data as ImpactGraphNode)
  }, [onNodeSelect])

  const onPaneClick = useCallback(() => {
    onNodeSelect?.(null)
  }, [onNodeSelect])

  return (
    <div className="relative h-full w-full bg-surface">
      {isTruncated && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 bg-warning/10 border border-warning/30 rounded-lg text-[11px] text-warning font-medium shadow-sm">
          ⚠ Graph truncated — showing most relevant nodes
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.3}
        maxZoom={1.8}
        attributionPosition="bottom-right"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
        <Controls className="!bg-surface !border-border !rounded-xl" />
        <MiniMap
          className="!bg-surface !border-border !rounded-xl"
          nodeColor={(n) => {
            const t = (n.data as ImpactGraphNode).type
            return t === "REQUIREMENT" ? "var(--accent)" :
                   t === "CONTROLLER" || t === "API_ROUTE" ? "var(--info)" :
                   t === "ENTITY" ? "var(--success)" :
                   t === "TEST" ? "var(--warning)" :
                   t === "UNKNOWN" ? "var(--danger)" :
                   t === "QA_SCENARIO" ? "var(--info)" :
                   "var(--accent)"
          }}
        />
      </ReactFlow>
    </div>
  )
}
