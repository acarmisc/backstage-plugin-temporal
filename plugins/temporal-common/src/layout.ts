/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: MIT
 */

import dagre from '@dagrejs/dagre';
import type { WorkflowGraph } from './graph';

export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 64;

export interface PositionedNode {
  id: string;
  /** Top-left corner, in diagram coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedEdge {
  from: string;
  to: string;
  /** Polyline from source to target, as computed by the layout. */
  points: Array<{ x: number; y: number }>;
}

export interface GraphLayout {
  width: number;
  height: number;
  nodes: PositionedNode[];
  edges: PositionedEdge[];
}

/**
 * Layered layout, top to bottom, the way `kbflow diagram` draws it: each stage
 * sits one rank below its dependencies, and independent sources share a rank.
 * Coordinates are computed by dagre (MIT).
 */
export function layoutGraph(graph: WorkflowGraph): GraphLayout {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 56, marginx: 16, marginy: 16 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  graph.edges.forEach((edge, index) => {
    g.setEdge(edge.from, edge.to, {}, `e${index}`);
  });
  dagre.layout(g);

  const label = g.graph();
  return {
    width: label.width ?? 0,
    height: label.height ?? 0,
    nodes: graph.nodes.map(node => {
      const placed = g.node(node.id);
      return {
        id: node.id,
        x: placed.x - NODE_WIDTH / 2,
        y: placed.y - NODE_HEIGHT / 2,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      };
    }),
    edges: graph.edges.map((edge, index) => {
      const placed = g.edge({ v: edge.from, w: edge.to, name: `e${index}` });
      return { from: edge.from, to: edge.to, points: placed?.points ?? [] };
    }),
  };
}
