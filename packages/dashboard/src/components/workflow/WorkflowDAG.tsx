import { useMemo } from 'react';
import ReactFlow, { Background, Controls, MarkerType } from 'react-flow-renderer';
import type { Node, Edge } from 'react-flow-renderer';
import dagre from 'dagre';
import type { WorkflowStep } from '../../types';

const NODE_W = 160;
const NODE_H = 44;

function nodeStyle(isComp: boolean, status?: string): React.CSSProperties {
  if (status === 'COMPLETED')
    return { background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 6, fontSize: 11, color: '#166534', width: NODE_W };
  if (status === 'FAILED')
    return { background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 6, fontSize: 11, color: '#991b1b', width: NODE_W };
  if (status === 'RUNNING')
    return { background: '#eff6ff', border: '1.5px solid #93c5fd', borderRadius: 6, fontSize: 11, color: '#1d4ed8', width: NODE_W };
  if (isComp)
    return { background: '#fff1f2', border: '1.5px solid #fca5a5', borderRadius: 6, fontSize: 11, color: '#dc2626', width: NODE_W };
  return { background: '#f9fafb', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 11, color: '#374151', width: NODE_W };
}

function buildLayout(
  steps: WorkflowStep[],
  stepStatuses?: Record<string, string>,
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', ranksep: 80, nodesep: 40 });

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const seen = new Set<string>();

  const addNode = (id: string, isComp: boolean) => {
    if (seen.has(id)) return;
    seen.add(id);
    g.setNode(id, { width: NODE_W, height: NODE_H });
    nodes.push({
      id,
      data: { label: id.length > 18 ? id.slice(0, 16) + '…' : id },
      position: { x: 0, y: 0 },
      style: nodeStyle(isComp, stepStatuses?.[id]),
    });
  };

  steps.forEach((s) => addNode(s.name, false));

  // Forward edges
  steps.slice(0, -1).forEach((s, i) => {
    g.setEdge(s.name, steps[i + 1].name);
    edges.push({
      id: `fwd-${s.name}-${steps[i + 1].name}`,
      source: s.name,
      target: steps[i + 1].name,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
    });
  });

  // Compensation edges (dashed red)
  steps.forEach((s) => {
    if (s.compensation) {
      addNode(s.compensation, true);
      g.setEdge(s.name, s.compensation);
      edges.push({
        id: `comp-${s.name}-${s.compensation}`,
        source: s.name,
        target: s.compensation,
        style: { stroke: '#f87171', strokeWidth: 1.5, strokeDasharray: '5,3' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#f87171' },
      });
    }
  });

  dagre.layout(g);
  nodes.forEach((n) => {
    const pos = g.node(n.id);
    n.position = { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 };
  });

  return { nodes, edges };
}

interface Props {
  steps: WorkflowStep[];
  /** Optional: colour nodes by last-execution step status (COMPLETED | FAILED | RUNNING) */
  stepStatuses?: Record<string, string>;
}

export function WorkflowDAG({ steps, stepStatuses }: Props) {
  const { nodes, edges } = useMemo(
    () => buildLayout(steps, stepStatuses),
    [steps, stepStatuses],
  );

  if (steps.length === 0) {
    return <p className="text-sm text-gray-400">No steps to display.</p>;
  }

  return (
    <div style={{ height: 300 }} className="w-full rounded border border-gray-200">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
