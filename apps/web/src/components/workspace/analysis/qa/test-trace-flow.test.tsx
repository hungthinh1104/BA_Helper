import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { staticTestTraceFixture, traceIds } from '../../../../../../../tests/fixtures/static-test-trace.fixture';
import { testTraceLabels } from '@/lib/i18n/test-trace-labels';
import { TestTraceFlow } from './test-trace-flow';

jest.mock('@xyflow/react', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  type NodeView = { id: string; position: { x: number; y: number }; data: { nodeLabel: string; title: string } };
  type EdgeView = { id: string; source: string; target: string; label?: string; style?: { strokeDasharray?: string } };
  return {
    ReactFlow: ({ nodes, edges, children }: { nodes: NodeView[]; edges: EdgeView[]; children?: ReactNode }) => React.createElement(
      'div', { 'data-testid': 'flow-elements' }, [
        ...nodes.map(node => React.createElement('div', {
          key: node.id, 'data-testid': `node-${node.id}`, 'data-position': `${node.position.x},${node.position.y}`,
        }, `${node.data.nodeLabel}: ${node.data.title}`)),
        ...edges.map(edge => React.createElement('div', {
          key: edge.id, 'data-testid': `edge-${edge.id}`, 'data-source': edge.source, 'data-target': edge.target,
          'data-dashed': edge.style?.strokeDasharray ? 'true' : 'false',
        }, edge.label)),
        children,
      ],
    ),
    Background: () => null,
    Handle: () => null,
    MarkerType: { ArrowClosed: 'arrowclosed' },
    Position: { Bottom: 'bottom', Left: 'left', Right: 'right', Top: 'top' },
    BackgroundVariant: { Dots: 'dots' },
  };
});

describe('focused test trace graph', () => {
  it('keeps method paths ordered and marks requirement impact as analysis context', () => {
    const data = staticTestTraceFixture();
    const trace = data.items[0].testArtifacts[0].trace!;
    const target = trace.artifacts[1];
    const intermediate = { ...target, id: 'service-method-id', artifactKey: 'service:refund-wrapper', label: 'PaymentService.refund wrapper' };
    trace.relation = 'CALL_PATH';
    trace.artifacts.splice(1, 0, intermediate);
    trace.edges[0] = { ...trace.edges[0], targetArtifactId: intermediate.id };
    trace.edges.push({ ...trace.edges[0], edgeId: 'call-edge', sourceArtifactId: intermediate.id, targetArtifactId: target.id, type: 'CALLS' });

    const props = { trace, requirementTitle: 'Cancel paid booking', requirementSummary: 'Refund after cancellation.',
      impactLabel: 'PaymentService.refund', labels: testTraceLabels.en };
    const view = render(<TestTraceFlow {...props} />);
    expect(screen.getByTestId(`node-${traceIds.test}`)).toHaveTextContent('Test declaration: refunds once');
    expect(screen.getByTestId('node-service-method-id')).toHaveTextContent('Code artifact: PaymentService.refund wrapper');
    expect(screen.getByTestId(`node-${traceIds.code}`)).toHaveAttribute('data-position', '500,140');
    expect(screen.getByTestId(`node-requirement:${traceIds.code}`)).toHaveTextContent('Requirement context: Cancel paid booking');
    expect(screen.getByTestId('edge-edge-1')).toHaveTextContent('test reference');
    expect(screen.getByTestId('edge-call-edge')).toHaveTextContent('calls');
    expect(screen.getByTestId(`edge-analysis-impact:${traceIds.code}`)).toHaveAttribute('data-dashed', 'true');
    const positions = screen.getAllByTestId(/^node-/).map(node => node.getAttribute('data-position'));

    view.rerender(<TestTraceFlow {...props} />);
    expect(screen.getAllByTestId(/^node-/).map(node => node.getAttribute('data-position'))).toEqual(positions);
  });
});
