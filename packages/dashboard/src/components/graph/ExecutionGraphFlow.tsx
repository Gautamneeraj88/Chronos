import { useMemo } from 'react';
import ReactFlow, { Background, Controls, MarkerType } from 'react-flow-renderer';
import type { Node, Edge } from 'react-flow-renderer';
import dagre from 'dagre';
import type { StepExecutionRecord } from '../../types';

const NODE_W = 180;
const NODE_H = 54;

function statusStyle(status: string): React.CSSProperties {
  if (status === 'COMPLETED')
    return { background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 6, fontSize: 11, color: '#166534', width: NODE_W };
  if (status === 'FAILED')
    return { background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 6, fontSize: 11, color: '#991b1b', width: NODE_W };
  if (status.startsWith('COMPENSATION'))
    return { background: '#fff7ed', border: '1.5px solid #fdba74', borderRadius: 6, fontSize: 11, color: '#9a3412', width: NODE_W };
  return { background: '#f9fafb', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 11, color: '#374151', width: NODE_W };
}

function buildExecutionLayout(records: StepExecutionRecord[]): { nodes: Node[]; edges: Edge[] } {
  const sorted = [...records].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 60, nodesep: 50 });

  const nodes: Node[] = sorted.map((rec, i) => {
    const id = `${rec.step}-${i}`;
    g.setNode(id, { width: NODE_W, height: NODE_H });
    return {
      id,
      data: {
        label: (
          <div className="text-center">
            <div className="font-medium">{rec.step}</div>
            <div className="text-xs opacity-70">{rec.status} · {Math.round(rec.durationMs)}ms</div>
          </div>
        ),
      },
      position: { x: 0, y: 0 },
      style: statusStyle(rec.status),
    };
  });

  const edges: Edge[] = sorted.slice(0, -1).map((_, i) => {
    const src = `${sorted[i].step}-${i}`;
    const tgt = `${sorted[i + 1].step}-${i + 1}`;
    g.setEdge(src, tgt);
    return {
      id: `e-${i}`,
      source: src,
      target: tgt,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
    };
  });

  dagre.layout(g);
  nodes.forEach((n) => {
    const pos = g.node(n.id);
    n.position = { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 };
  });

  return { nodes, edges };
}

interface Props {
  records: StepExecutionRecord[];
}

export function ExecutionGraphFlow({ records }: Props) {
  const { nodes, edges } = useMemo(() => buildExecutionLayout(records), [records]);

  if (records.length === 0) return null;

  const height = Math.max(300, records.length * 80);

  return (
    <div style={{ height }} className="w-full rounded border border-gray-200 mt-3">
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
