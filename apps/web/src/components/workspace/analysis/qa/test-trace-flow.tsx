"use client"

import { useMemo } from 'react';
import {
  Background, BackgroundVariant, Handle, MarkerType, Position, ReactFlow,
} from '@xyflow/react';
import type { Edge, Node, NodeProps, NodeTypes } from '@xyflow/react';
import type { QaTestTrace } from '@ba-helper/contracts';
import type { TestTraceLabels } from '@/lib/i18n/test-trace-labels';

type TraceNodeData = {
  kind: 'requirement' | 'test' | 'code';
  nodeLabel: string;
  title: string;
  subtitle: string;
};
type TraceNode = Node<TraceNodeData, 'traceStep'>;
const nodeTypes: NodeTypes = { traceStep: TraceStepNode };

export function TestTraceFlow({ trace, requirementTitle, requirementSummary, impactLabel, labels }: {
  trace: QaTestTrace;
  requirementTitle?: string;
  requirementSummary?: string;
  impactLabel: string;
  labels: TestTraceLabels;
}) {
  const nodes = useMemo<TraceNode[]>(() => {
    const pathNodes: TraceNode[] = trace.artifacts.map((artifact, index) => ({
      id: artifact.id,
      type: 'traceStep' as const,
      position: { x: index * 250, y: 140 },
      data: {
        kind: index === 0 ? 'test' as const : 'code' as const,
        nodeLabel: index === 0 ? labels.testNode : labels.codeNode,
        title: artifact.label,
        subtitle: `${artifact.filePath}${artifact.startLine ? ` · L${artifact.startLine}` : ''}`,
      },
    }));
    const target = trace.artifacts.at(-1);
    if (!target || !requirementTitle?.trim()) return pathNodes;
    const summary = requirementSummary?.replace(/\s+/g, ' ').trim() ?? '';
    return [...pathNodes, {
      id: `requirement:${target.id}`,
      type: 'traceStep' as const,
      position: { x: (trace.artifacts.length - 1) * 250, y: 8 },
      data: {
        kind: 'requirement' as const,
        nodeLabel: labels.requirement,
        title: requirementTitle,
        subtitle: summary.length > 180 ? `${summary.slice(0, 179)}…` : summary,
      },
    }];
  }, [labels.codeNode, labels.requirement, labels.testNode, requirementSummary, requirementTitle, trace.artifacts]);

  const edges = useMemo<Edge[]>(() => {
    const pathEdges: Edge[] = trace.edges.map(edge => ({
      id: edge.edgeId,
      source: edge.sourceArtifactId,
      target: edge.targetArtifactId,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'smoothstep' as const,
      label: edge.type === 'TESTS' ? labels.testReference : labels.calls,
      labelStyle: { fill: 'var(--text-secondary)', fontSize: 10 },
      labelBgStyle: { fill: 'var(--background)' },
      style: { stroke: 'var(--text-tertiary)', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--text-tertiary)' },
    }));
    const target = trace.artifacts.at(-1);
    if (!target || !requirementTitle?.trim()) return pathEdges;
    return [...pathEdges, {
      id: `analysis-impact:${target.id}`,
      source: `requirement:${target.id}`,
      target: target.id,
      sourceHandle: 'impact-source',
      targetHandle: 'impact-target',
      type: 'smoothstep' as const,
      label: labels.analysisImpact,
      labelStyle: { fill: 'var(--text-secondary)', fontSize: 10 },
      labelBgStyle: { fill: 'var(--background)' },
      style: { stroke: 'var(--text-disabled)', strokeWidth: 1.5, strokeDasharray: '4 4' },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--text-disabled)' },
    }];
  }, [labels.analysisImpact, labels.calls, labels.testReference, requirementTitle, trace.artifacts, trace.edges]);

  const width = Math.max(500, trace.artifacts.length * 250);
  return (
    <div className="grid gap-2">
      <p className="text-[11px] text-muted-foreground">{labels.visualPath} · {impactLabel}</p>
      <div className="overflow-x-auto rounded-md border border-border/50 bg-background" role="img" aria-label={labels.visualPath}>
        <div style={{ width, height: 290 }}>
          <ReactFlow<TraceNode>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.12, minZoom: 0.65, maxZoom: 1 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            panOnDrag={false}
            zoomOnScroll={false}
            zoomOnDoubleClick={false}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--border)" />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

function TraceStepNode({ data }: NodeProps<TraceNode>) {
  const cardTone = data.kind === 'requirement'
    ? 'border-primary/40 bg-primary/5'
    : data.kind === 'test' ? 'border-warning/40 bg-warning/5' : 'border-border/60 bg-surface';
  return (
    <div className={`relative w-[220px] rounded-lg border px-3 py-2 shadow-sm ${cardTone}`}>
      {data.kind === 'requirement' ? <Handle type="source" id="impact-source" position={Position.Bottom} className="!invisible" /> : <>
        <Handle type="target" id="left" position={Position.Left} className="!invisible" />
        <Handle type="source" id="right" position={Position.Right} className="!invisible" />
        {data.kind === 'code' ? <Handle type="target" id="impact-target" position={Position.Top} className="!invisible" /> : null}
      </>}
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{data.nodeLabel}</p>
      <p className="mt-1 line-clamp-2 break-words text-xs font-semibold text-foreground" title={data.title}>{data.title}</p>
      <p className="mt-1 line-clamp-1 break-all font-mono text-[10px] text-muted-foreground" title={data.subtitle}>{data.subtitle}</p>
    </div>
  );
}
