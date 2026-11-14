/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: MIT
 */

import { useMemo } from 'react';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  kindColor,
  layoutGraph,
  NODE_HEIGHT,
  NODE_WIDTH,
  type StageState,
  type WorkflowGraph,
} from '@acarmisc/backstage-plugin-temporal-common';
import type { DiagramRendererProps } from './DiagramRenderer';

// Badge colours for the live state (M4). Kept here so the static diagram uses the same vocabulary.
const STATE_COLORS: Record<StageState, string> = {
  pending: '#94a3b8',
  running: '#3b82f6',
  ok: '#16a34a',
  warn: '#d97706',
  failed: '#dc2626',
  retrying: '#ea580c',
  'waiting-approval': '#f59e0b',
};

interface StageData extends Record<string, unknown> {
  label: string;
  kind: string;
  detail?: string;
  gate?: boolean;
  optional?: boolean;
  state?: StageState;
  dark: boolean;
}

function StageNode({ data }: NodeProps<Node<StageData>>) {
  const color = kindColor(data.kind);
  const text = data.dark ? '#e2e8f0' : '#0f172a';
  const muted = data.dark ? '#94a3b8' : '#475569';
  const background = data.dark ? '#1e293b' : '#ffffff';
  return (
    <div
      style={{
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        boxSizing: 'border-box',
        display: 'flex',
        borderRadius: 8,
        background,
        color: text,
        border: `2px ${data.optional ? 'dashed' : 'solid'} ${data.gate ? '#f59e0b' : color}`,
        overflow: 'hidden',
        fontFamily: 'Helvetica, Arial, sans-serif',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      }}
      data-testid={`stage-${data.label}`}
      data-state={data.state ?? 'static'}
    >
      <div style={{ width: 6, background: color }} />
      <div style={{ padding: '6px 10px', minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.label}
        </div>
        <div style={{ fontSize: 11, color: muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {[data.kind, data.detail, data.gate ? 'approval' : '', data.optional ? 'optional' : ''].filter(Boolean).join(' · ')}
        </div>
      </div>
      {data.state && (
        <div
          style={{
            alignSelf: 'center',
            marginRight: 8,
            width: 10,
            height: 10,
            borderRadius: 5,
            background: STATE_COLORS[data.state],
          }}
          title={data.state}
        />
      )}
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

const nodeTypes = { stage: StageNode };

function toFlow(graph: WorkflowGraph, states: DiagramRendererProps['states'], dark: boolean) {
  const layout = layoutGraph(graph);
  const byId = new Map(graph.nodes.map(node => [node.id, node]));
  const nodes: Node<StageData>[] = layout.nodes.map(box => {
    const node = byId.get(box.id)!;
    return {
      id: box.id,
      type: 'stage',
      position: { x: box.x, y: box.y },
      data: {
        label: node.label,
        kind: node.kind,
        detail: node.detail,
        gate: node.gate,
        optional: node.optional,
        state: states?.[box.id],
        dark,
      },
      draggable: false,
      selectable: false,
    };
  });
  const edges: Edge[] = graph.edges.map((edge, index) => {
    const targetState = states?.[edge.to];
    const active = targetState === 'running' || targetState === 'retrying';
    return {
      id: `e${index}`,
      source: edge.from,
      target: edge.to,
      type: 'smoothstep',
      animated: active,
      style: { stroke: dark ? '#64748b' : '#94a3b8', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: dark ? '#64748b' : '#94a3b8' },
      selectable: false,
    };
  });
  return { nodes, edges };
}

/** Default diagram renderer: React Flow with a layered (dagre) layout. */
export function WorkflowDiagram({ graph, states, dark = false }: DiagramRendererProps) {
  const { nodes, edges } = useMemo(() => toFlow(graph, states, dark), [graph, states, dark]);
  return (
    <div style={{ width: '100%', height: '100%', minHeight: 320 }} data-testid="workflow-diagram">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: false }}
          colorMode={dark ? 'dark' : 'light'}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
