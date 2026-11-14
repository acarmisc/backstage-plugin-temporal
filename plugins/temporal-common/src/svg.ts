/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WorkflowGraph } from './graph';
import { GraphLayout, layoutGraph } from './layout';
import { kindColor } from './palette';

const escapeXml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const PAD = 16;

/**
 * Standalone SVG of the graph, on a white background, for export. Stands on its
 * own (no CSS, no fonts from the page), so it can be opened or converted anywhere.
 */
export function graphToSvg(graph: WorkflowGraph, layout: GraphLayout = layoutGraph(graph)): string {
  const width = layout.width + PAD * 2;
  const height = layout.height + PAD * 2;
  const byId = new Map(layout.nodes.map(node => [node.id, node]));
  const parts: string[] = [];

  for (const edge of layout.edges) {
    const points = edge.points.map(p => `${p.x + PAD},${p.y + PAD}`).join(' ');
    parts.push(
      `<polyline points="${points}" fill="none" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>`,
    );
  }

  for (const node of graph.nodes) {
    const box = byId.get(node.id)!;
    const x = box.x + PAD;
    const y = box.y + PAD;
    const dash = node.optional ? ' stroke-dasharray="6 4"' : '';
    const stroke = node.gate ? '#f59e0b' : kindColor(node.kind);
    parts.push(
      `<rect x="${x}" y="${y}" width="${box.width}" height="${box.height}" rx="8" fill="#ffffff" stroke="${stroke}" stroke-width="2"${dash}/>`,
      `<rect x="${x}" y="${y}" width="6" height="${box.height}" rx="3" fill="${kindColor(node.kind)}"/>`,
      `<text x="${x + 16}" y="${y + 26}" font-family="Helvetica, Arial, sans-serif" font-size="14" font-weight="600" fill="#0f172a">${escapeXml(node.label)}</text>`,
      `<text x="${x + 16}" y="${y + 46}" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#475569">${escapeXml(
        [node.kind, node.detail, node.gate ? 'approval' : '', node.optional ? 'optional' : ''].filter(Boolean).join(' · ').slice(0, 32),
      )}</text>`,
    );
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/></marker></defs>`,
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
    ...parts,
    `</svg>`,
  ].join('\n');
}
